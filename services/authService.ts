import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Provider } from '@supabase/supabase-js';
import { supabase, translateAuthError } from '@/lib/supabase';
import { userRepository } from '@/repositories/userRepository';
import { User } from '@/domain/models';
import { AuthProvider } from '@/domain/enums';
import { env } from '@/config/env';

// Cierra la pestaña del navegador en cuanto vuelve el redirect (Android/web).
WebBrowser.maybeCompleteAuthSession();

export class AuthError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** El usuario cerró la ventana de OAuth: no es un fallo, no hay que alertar. */
export class AuthCancelledError extends AuthError {
  constructor() {
    super('Inicio de sesión cancelado', 'cancelled');
    this.name = 'AuthCancelledError';
  }
}

/**
 * URL de retorno tras el consentimiento del proveedor.
 *
 * En desarrollo, Expo Go sirve en `exp://…`, así que `makeRedirectUri` genera
 * la URL correcta según el entorno. Esa URL debe estar en la lista de
 * "Redirect URLs" del proyecto de Supabase (ver `docs/OAUTH_SETUP.md`).
 */
function redirectUri(): string {
  return AuthSession.makeRedirectUri({ scheme: env.scheme, path: 'auth/callback' });
}

export const authService = {
  // ─── Correo y contraseña ────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new AuthError(translateAuthError(error.message), error.code);
    return ensureProfile(data.user!.id, {
      email: data.user!.email ?? email,
      provider: AuthProvider.EMAIL,
    });
  },

  async register(params: {
    fullName: string;
    phone: string;
    email: string;
    password: string;
    acceptedTerms: boolean;
  }): Promise<{ user: User | null; needsEmailConfirmation: boolean }> {
    if (!params.acceptedTerms) {
      throw new AuthError('Debes aceptar los Términos y la Política de Privacidad.');
    }

    const email = params.email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: params.password,
      options: {
        // Los metadatos viajan en el JWT y el trigger de la base de datos los
        // usa para crear el perfil aunque la confirmación llegue días después.
        data: {
          full_name: params.fullName.trim(),
          phone: params.phone.trim(),
          auth_provider: AuthProvider.EMAIL,
          accepted_terms_at: new Date().toISOString(),
        },
        emailRedirectTo: redirectUri(),
      },
    });
    if (error) throw new AuthError(translateAuthError(error.message), error.code);
    if (!data.user) throw new AuthError('No se pudo crear la cuenta.');

    // Con confirmación de correo activada no hay sesión todavía.
    if (!data.session) return { user: null, needsEmailConfirmation: true };

    const user = await ensureProfile(data.user.id, {
      email,
      fullName: params.fullName.trim(),
      phone: params.phone.trim(),
      provider: AuthProvider.EMAIL,
      acceptedTermsAt: new Date().toISOString(),
    });
    return { user, needsEmailConfirmation: false };
  },

  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: redirectUri(),
    });
    if (error) throw new AuthError(translateAuthError(error.message), error.code);
  },

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new AuthError(translateAuthError(error.message), error.code);
  },

  // ─── Google y Facebook (OAuth por navegador) ────────────────────────────────

  /**
   * Flujo OAuth con PKCE en una sesión de navegador del sistema.
   *
   * Se usa el navegador del sistema, no un WebView: es lo que exigen las
   * políticas de Google (RFC 8252) y lo que permite reutilizar la sesión ya
   * iniciada en el teléfono.
   */
  async signInWithProvider(provider: Extract<Provider, 'google' | 'facebook'>): Promise<User> {
    const redirectTo = redirectUri();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        // Somos nosotros quienes abrimos el navegador, no el SDK.
        skipBrowserRedirect: true,
        queryParams: provider === 'google'
          // `offline` + `consent` garantizan refresh token también en el
          // segundo inicio de sesión, no sólo en el primero.
          ? { access_type: 'offline', prompt: 'consent' }
          : undefined,
      },
    });
    if (error) throw new AuthError(translateAuthError(error.message), error.code);
    if (!data?.url) throw new AuthError('El proveedor no devolvió una URL de autorización.');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
      showInRecents: false,
      preferEphemeralSession: false,
    });

    if (result.type === 'cancel' || result.type === 'dismiss') throw new AuthCancelledError();
    if (result.type !== 'success') throw new AuthError('No se completó el inicio de sesión.');

    const session = await exchangeRedirect(result.url);
    return ensureProfile(session.userId, {
      email: session.email,
      fullName: session.fullName,
      avatarUrl: session.avatarUrl,
      provider: provider === 'google' ? AuthProvider.GOOGLE : AuthProvider.FACEBOOK,
    });
  },

  signInWithGoogle: () => authService.signInWithProvider('google'),

  // ─── Apple (nativo) ─────────────────────────────────────────────────────────

  /** `Sign in with Apple` sólo existe en iOS 13+; en el resto se oculta el botón. */
  async isAppleSignInAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;
    try {
      return await AppleAuthentication.isAvailableAsync();
    } catch {
      return false;
    }
  },

  /**
   * Apple entrega un `identityToken` firmado que Supabase valida directamente:
   * no hace falta pasar por el navegador.
   *
   * Apple sólo manda nombre y correo **la primera vez** que el usuario autoriza
   * la app. Por eso el perfil se guarda en ese momento; si se reinstala y
   * vuelve a entrar, esos campos llegan vacíos y se conserva lo ya guardado.
   */
  async signInWithApple(): Promise<User> {
    // El nonce evita que un token robado se reutilice: Apple firma su hash y
    // Supabase comprueba que coincide con el que enviamos.
    const rawNonce = randomNonce();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') throw new AuthCancelledError();
      throw new AuthError(e?.message ?? 'No se pudo iniciar sesión con Apple.');
    }

    if (!credential.identityToken) {
      throw new AuthError('Apple no devolvió un token de identidad.');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) throw new AuthError(translateAuthError(error.message), error.code);

    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ');

    return ensureProfile(data.user!.id, {
      email: credential.email ?? data.user!.email ?? '',
      fullName: fullName || undefined,
      provider: AuthProvider.APPLE,
    });
  },

  // ─── Sesión ─────────────────────────────────────────────────────────────────

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new AuthError(translateAuthError(error.message), error.code);
  },

  async currentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return ensureProfile(user.id, profileDataFrom(user));
  },

  async updateProfile(patch: { fullName?: string; phone?: string; marketingOptIn?: boolean }): Promise<User> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AuthError('No hay sesión activa.');
    return userRepository.update(user.id, patch);
  },

  /**
   * Borrado de cuenta, requisito de la App Store (guía 5.1.1(v)) y de Google Play.
   *
   * El cliente no puede borrar filas de `auth.users`, así que lo hace la función
   * SQL `delete_own_account` (ver `supabase/account_deletion_migration.sql`),
   * que sólo puede borrar la cuenta de quien la llama. Si falla, la sesión se
   * mantiene: cerrarla haría creer al usuario que su cuenta ya no existe.
   */
  async requestAccountDeletion(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AuthError('No hay sesión activa.');

    const { error } = await supabase.rpc('delete_own_account');
    if (error) throw new AuthError(error.message);

    // La cuenta ya no existe en el servidor; sólo queda limpiar la sesión local.
    await supabase.auth.signOut({ scope: 'local' });
  },
};

// ─── Ayudantes ────────────────────────────────────────────────────────────────

interface RedirectSession {
  userId: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
}

/**
 * Convierte la URL de retorno en una sesión de Supabase.
 *
 * Con PKCE llega `?code=…` y hay que canjearlo. Algunos proveedores todavía
 * devuelven los tokens en el fragmento (`#access_token=…`), así que se
 * contemplan ambos caminos.
 */
async function exchangeRedirect(url: string): Promise<RedirectSession> {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));

  const errorDescription = params.get('error_description') ?? fragment.get('error_description');
  if (errorDescription) throw new AuthError(errorDescription);

  const code = params.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw new AuthError(translateAuthError(error.message), error.code);
    return fromSupabaseUser(data.user);
  }

  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw new AuthError(translateAuthError(error.message), error.code);
    return fromSupabaseUser(data.user);
  }

  throw new AuthError('La respuesta del proveedor no incluyó credenciales.');
}

function fromSupabaseUser(user: { id: string; email?: string; user_metadata?: any } | null): RedirectSession {
  if (!user) throw new AuthError('El proveedor no devolvió un usuario.');
  const meta = user.user_metadata ?? {};
  return {
    userId: user.id,
    email: user.email ?? meta.email ?? '',
    fullName: meta.full_name ?? meta.name ?? undefined,
    avatarUrl: meta.avatar_url ?? meta.picture ?? undefined,
  };
}

/**
 * Crea el perfil de la tabla `users` si aún no existe.
 *
 * El esquema incluye un trigger que lo hace en el servidor, pero esta red de
 * seguridad cubre las cuentas creadas antes de instalarlo y los proveedores que
 * completan datos después del primer inicio de sesión.
 */
async function ensureProfile(
  userId: string,
  data: {
    email: string;
    fullName?: string;
    phone?: string;
    avatarUrl?: string;
    provider?: AuthProvider;
    acceptedTermsAt?: string;
  },
): Promise<User> {
  const existing = await userRepository.getById(userId);
  if (existing) {
    // Rellena huecos sin pisar lo que el usuario haya editado a mano. El
    // nombre provisional (la parte del correo antes de la @) cuenta como hueco.
    const patch: Record<string, unknown> = {};
    const placeholderName = !existing.fullName || existing.fullName === data.email.split('@')[0];
    if (placeholderName && data.fullName) patch.fullName = data.fullName;
    if (!existing.phone && data.phone) patch.phone = data.phone;
    if (!existing.avatarUrl && data.avatarUrl) patch.avatarUrl = data.avatarUrl;
    if (Object.keys(patch).length > 0) return userRepository.update(userId, patch);
    return existing;
  }

  return userRepository.upsert({
    id: userId,
    email: data.email,
    fullName: data.fullName ?? data.email.split('@')[0],
    phone: data.phone ?? '',
    avatarUrl: data.avatarUrl,
    authProvider: data.provider ?? AuthProvider.EMAIL,
    acceptedTermsAt: data.acceptedTermsAt ?? new Date().toISOString(),
  });
}

/**
 * Datos de perfil que ya trae la sesión: los metadatos del registro con correo
 * (nombre, celular, aceptación de términos) o los que entrega Google o Apple.
 * Sin esto, el primer perfil se creaba sólo con el correo y el nombre quedaba
 * como la parte antes de la @.
 */
function profileDataFrom(user: {
  email?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}) {
  const meta = user.user_metadata ?? {};
  const provider = String(user.app_metadata?.provider ?? 'email').toUpperCase();
  return {
    email: user.email ?? meta.email ?? '',
    fullName: meta.full_name ?? meta.name ?? undefined,
    phone: meta.phone ?? undefined,
    avatarUrl: meta.avatar_url ?? meta.picture ?? undefined,
    provider: (Object.values(AuthProvider) as string[]).includes(provider)
      ? (provider as AuthProvider)
      : AuthProvider.EMAIL,
    acceptedTermsAt: meta.accepted_terms_at ?? undefined,
  };
}

/** Nonce criptográficamente aleatorio en hexadecimal. */
function randomNonce(bytes = 32): string {
  return Array.from(Crypto.getRandomBytes(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

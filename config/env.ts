import Constants from 'expo-constants';

/**
 * Acceso tipado a la configuración. Todo lo que empieza por `EXPO_PUBLIC_` se
 * empaqueta en el binario y **es visible** para cualquiera que lo descargue:
 * aquí sólo van claves diseñadas para clientes públicos (la anon key de
 * Supabase, restringida por RLS, y claves de mapas restringidas por bundle id).
 * Los secretos de verdad viven en Edge Functions del servidor.
 */

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

/**
 * Expo sólo incrusta en el binario las variables escritas literalmente
 * (`process.env.EXPO_PUBLIC_X`); un acceso dinámico como `process.env[key]`
 * llega vacío en los builds de EAS. Por eso cada una se nombra aquí a mano.
 */
const PUBLIC_ENV: Record<string, string | undefined> = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_GOOGLE_DIRECTIONS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_API_KEY,
  EXPO_PUBLIC_LEGAL_BASE_URL: process.env.EXPO_PUBLIC_LEGAL_BASE_URL,
  EXPO_PUBLIC_SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
  EXPO_PUBLIC_PRIVACY_EMAIL: process.env.EXPO_PUBLIC_PRIVACY_EMAIL,
};

function read(key: string): string | undefined {
  const value = PUBLIC_ENV[key] ?? extra[key];
  return value && value.length > 0 ? value : undefined;
}

function required(key: string): string {
  const value = read(key);
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${key}. Copia .env.example a .env y complétala.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: required('EXPO_PUBLIC_SUPABASE_ANON_KEY'),

  /**
   * Clave de la Directions API de Google. Opcional: sin ella la app calcula
   * una ruta aproximada en el dispositivo (ver `navigationService`).
   * Restríngela por bundle id / SHA-1 en la consola de Google Cloud.
   */
  googleDirectionsKey: read('EXPO_PUBLIC_GOOGLE_DIRECTIONS_API_KEY'),

  /** Esquema de URL para los redirects de OAuth. Debe coincidir con app.config.ts. */
  scheme: Constants.expoConfig?.scheme?.toString() ?? 'parknow',

  /** Dominio donde se publican las políticas; los stores exigen una URL. */
  legalBaseUrl: read('EXPO_PUBLIC_LEGAL_BASE_URL') ?? 'https://aldairmm18.github.io/parknow',
  supportEmail: read('EXPO_PUBLIC_SUPPORT_EMAIL') ?? 'aldairmmm2@gmail.com',
  privacyEmail: read('EXPO_PUBLIC_PRIVACY_EMAIL') ?? 'aldairmmm2@gmail.com',

  appVersion: Constants.expoConfig?.version ?? '1.0.0',
  buildNumber:
    Constants.expoConfig?.ios?.buildNumber ??
    String(Constants.expoConfig?.android?.versionCode ?? '1'),

  isProduction: process.env.NODE_ENV === 'production',
} as const;

/** ¿Hay enrutado real disponible, o toca la estimación local? */
export const hasDirectionsApi = () => Boolean(env.googleDirectionsKey);

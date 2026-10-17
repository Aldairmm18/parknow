import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient, SupportedStorage } from '@supabase/supabase-js';
import { env } from '@/config/env';

/**
 * Los tokens de sesión son credenciales: en el dispositivo van al llavero de
 * iOS / Keystore de Android, no a AsyncStorage (que en un teléfono con root o
 * en un backup sin cifrar se lee en claro).
 *
 * SecureStore tiene un límite de 2048 bytes por entrada y la sesión de Supabase
 * puede superarlo cuando el JWT lleva muchos claims, así que se trocea.
 */
const CHUNK_SIZE = 1800;

const secureStorage: SupportedStorage = {
  async getItem(key) {
    const head = await SecureStore.getItemAsync(chunkKey(key, 0));
    if (head === null) return null;
    if (!head.startsWith(CHUNK_PREFIX)) return head;

    const count = Number(head.slice(CHUNK_PREFIX.length));
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i + 1))),
    );
    // Escritura incompleta: se trata como sesión ausente.
    if (parts.some((part) => part === null)) return null;
    return parts.join('');
  },

  async setItem(key, value) {
    await clearChunks(key);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(chunkKey(key, 0), value);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
    // El encabezado se escribe al final: si el proceso muere a mitad, la
    // siguiente lectura no encuentra encabezado y no devuelve datos corruptos.
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i + 1), chunk)));
    await SecureStore.setItemAsync(chunkKey(key, 0), `${CHUNK_PREFIX}${chunks.length}`);
  },

  async removeItem(key) {
    await clearChunks(key);
  },
};

const CHUNK_PREFIX = '__chunks__:';
const chunkKey = (key: string, index: number) =>
  // SecureStore sólo admite [A-Za-z0-9._-] en las claves.
  `${key.replace(/[^A-Za-z0-9._-]/g, '_')}${index === 0 ? '' : `_${index}`}`;

async function clearChunks(key: string) {
  const head = await SecureStore.getItemAsync(chunkKey(key, 0)).catch(() => null);
  if (head?.startsWith(CHUNK_PREFIX)) {
    const count = Number(head.slice(CHUNK_PREFIX.length));
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.deleteItemAsync(chunkKey(key, i + 1)).catch(() => {})),
    );
  }
  await SecureStore.deleteItemAsync(chunkKey(key, 0)).catch(() => {});
}

// En web no hay llavero; Supabase usa localStorage por defecto.
const storage = Platform.OS === 'web' ? undefined : secureStorage;

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    // Sólo el navegador entrega la sesión en la URL; en nativo la leemos
    // nosotros del redirect de OAuth.
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});

/**
 * Supabase refresca el token con un temporizador; si la app estuvo en segundo
 * plano ese temporizador no corre y el token puede caducar. Se reanuda al
 * volver al primer plano.
 */
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Mensajes de Supabase traducidos a algo que una persona entienda. */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ese correo ya tiene una cuenta. Inicia sesión.';
  if (m.includes('password should be at least')) return 'La contraseña es demasiado corta.';
  if (m.includes('rate limit') || m.includes('too many requests')) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  // "For security purposes, you can only request this after 55 seconds."
  const wait = m.match(/only request this after (\d+) seconds/);
  if (wait) return `Ya enviamos una solicitud. Espera ${wait[1]} segundos e inténtalo de nuevo.`;
  if (m.includes('error sending') && m.includes('email')) {
    return 'No pudimos enviarte el correo de confirmación. Inténtalo más tarde o escríbenos a soporte.';
  }
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'El registro está deshabilitado por ahora.';
  if (m.includes('weak password') || m.includes('password is known to be weak')) return 'Esa contraseña es muy fácil de adivinar. Elige otra.';
  if (m.includes('network') || m.includes('fetch')) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
  if (m.includes('user not found')) return 'No encontramos una cuenta con ese correo.';
  return message;
}

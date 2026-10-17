import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Toda la configuración estática vive en `app.json`. Este archivo solo añade
 * lo que sale de variables de entorno, para no dejar claves escritas en el repo.
 *
 * GOOGLE_MAPS_API_KEY: clave de Maps SDK for Android. Sin ella la app no monta
 * mapas en Android (ver `lib/maps.ts`). Restríngela en Google Cloud al paquete
 * `com.aldairmm24.parknow` y a la huella SHA-1 de la llave de firma de Play.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;

  return {
    ...(config as ExpoConfig),
    extra: {
      ...config.extra,
      // La app lo lee para no montar Google Maps sin clave: en Android eso
      // cierra la app con "API key not found".
      hasGoogleMapsKey: Boolean(mapsKey),
    },
    plugins: [
      ...(config.plugins ?? []),
      ['react-native-maps', mapsKey ? { androidGoogleMapsApiKey: mapsKey } : {}],
    ],
  };
};

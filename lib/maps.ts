import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * ¿Se puede montar un `MapView`?
 *
 * En Android el mapa es Google Maps y exige `GOOGLE_MAPS_API_KEY` al compilar
 * (ver `app.config.ts`); sin ella la app se cierra al abrir cualquier mapa.
 * En iOS se usa Apple Maps, que no necesita clave.
 */
export const mapsAvailable =
  Platform.OS !== 'android' || Boolean(Constants.expoConfig?.extra?.hasGoogleMapsKey);

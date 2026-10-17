import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { LatLng } from '@/lib/geo';

export type LocationPermission = 'undetermined' | 'granted' | 'denied';

export interface UserLocation extends LatLng {
  /** Precisión horizontal en metros, si el dispositivo la reporta. */
  accuracy?: number | null;
  /** Rumbo en grados; `null` cuando el vehículo está detenido. */
  heading?: number | null;
  /** Velocidad en m/s. */
  speed?: number | null;
  timestamp: number;
}

interface Options {
  /** Empieza a seguir la posición en cuanto se concede el permiso. */
  watch?: boolean;
  /** Metros que debe moverse el dispositivo antes de emitir una actualización. */
  distanceInterval?: number;
  /** Milisegundos mínimos entre actualizaciones. */
  timeInterval?: number;
}

/**
 * Ubicación del usuario en primer plano.
 *
 * La app **no** pide permiso de ubicación en segundo plano: no lo necesita y
 * pedirlo dispara una revisión adicional en ambas tiendas. El seguimiento de
 * ruta sólo corre con la pantalla abierta.
 */
export function useUserLocation({ watch = false, distanceInterval = 12, timeInterval = 4000 }: Options = {}) {
  const [permission, setPermission] = useState<LocationPermission>('undetermined');
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const subscription = useRef<Location.LocationSubscription | null>(null);

  const toUserLocation = (p: Location.LocationObject): UserLocation => ({
    latitude: p.coords.latitude,
    longitude: p.coords.longitude,
    accuracy: p.coords.accuracy,
    heading: p.coords.heading,
    speed: p.coords.speed,
    timestamp: p.timestamp,
  });

  const request = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setError('Activa la ubicación del dispositivo para ver parqueaderos cerca de ti.');
        setLoading(false);
        return false;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermission('denied');
        setLoading(false);
        return false;
      }

      setPermission('granted');
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(toUserLocation(current));
      setLoading(false);
      return true;
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo obtener tu ubicación.');
      setLoading(false);
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (cancelled) return;
      if (status === 'granted') {
        setPermission('granted');
        await request();
      } else {
        setPermission(status === 'denied' ? 'denied' : 'undetermined');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [request]);

  useEffect(() => {
    if (!watch || permission !== 'granted') return;
    let active = true;

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval, timeInterval },
      (p) => { if (active) setLocation(toUserLocation(p)); },
    )
      .then((sub) => {
        if (!active) { sub.remove(); return; }
        subscription.current = sub;
      })
      .catch((e) => setError(e?.message ?? 'Se interrumpió el seguimiento de ubicación.'));

    return () => {
      active = false;
      subscription.current?.remove();
      subscription.current = null;
    };
  }, [watch, permission, distanceInterval, timeInterval]);

  return { location, permission, error, loading, request };
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { TravelMode, TripStatus } from '@/domain/enums';
import { distanceMeters, LatLng, pathLengthMeters, snapToPath } from '@/lib/geo';
import {
  ARRIVAL_RADIUS_METERS, navigationService, OFF_ROUTE_THRESHOLD_METERS, Route, RouteStep,
} from '@/services/navigationService';
import { useUserLocation, UserLocation } from './useUserLocation';

export interface TripState {
  status: TripStatus;
  route: Route | null;
  location: UserLocation | null;
  /** Metros que faltan siguiendo la ruta. */
  remainingMeters: number;
  /** Segundos restantes, ajustados al ritmo real del conductor. */
  remainingSeconds: number;
  /** Avance del trayecto, 0–1. */
  progress: number;
  /** Paso de la ruta que toca ahora. */
  currentStep: RouteStep | null;
  /** Próximo paso, para anticiparlo en pantalla. */
  nextStep: RouteStep | null;
  /** El conductor se salió del trazado. */
  offRoute: boolean;
  loading: boolean;
  error: string | null;
  /** Se está recalculando tras salirse de la ruta. */
  recalculating: boolean;
}

interface Options {
  destination: LatLng;
  mode?: TravelMode;
  /** Arranca el seguimiento en vivo al montar. */
  autoStart?: boolean;
  onArrive?: () => void;
}

/** No recalcular más de una vez cada 20 s aunque se siga fuera de la ruta. */
const RECALC_COOLDOWN_MS = 20_000;

/**
 * Seguimiento de la ruta hasta el parqueadero.
 *
 * Proyecta cada lectura del GPS sobre la polilínea para saber cuánto falta,
 * recalcula el trayecto cuando el conductor se desvía y avisa al llegar.
 */
export function useTripTracker({ destination, mode = TravelMode.DRIVING, autoStart = true, onArrive }: Options) {
  const { location, permission, request, error: locationError } = useUserLocation({ watch: autoStart });

  const [route, setRoute] = useState<Route | null>(null);
  const [status, setStatus] = useState<TripStatus>(TripStatus.PLANNED);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastRecalcRef = useRef(0);
  const arrivedRef = useRef(false);
  const originRef = useRef<LatLng | null>(null);

  const loadRoute = useCallback(async (from: LatLng, isRecalculation = false) => {
    if (isRecalculation) setRecalculating(true); else setLoading(true);
    setError(null);
    try {
      const next = await navigationService.getRoute(from, destination, mode);
      setRoute(next);
      originRef.current = from;
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo calcular la ruta.');
    } finally {
      setLoading(false);
      setRecalculating(false);
    }
  }, [destination, mode]);

  // Primera ruta, en cuanto haya una posición.
  useEffect(() => {
    if (route || !location) return;
    loadRoute({ latitude: location.latitude, longitude: location.longitude });
  }, [location, route, loadRoute]);

  const snap = useMemo(
    () => (route && location ? snapToPath(location, route.polyline) : null),
    [route, location],
  );

  const offRoute = (snap?.offsetMeters ?? 0) > OFF_ROUTE_THRESHOLD_METERS;

  // Recalcular al desviarse, con enfriamiento para no castigar la batería ni la cuota.
  useEffect(() => {
    if (!offRoute || !location || status === TripStatus.ARRIVED || recalculating) return;
    const now = Date.now();
    if (now - lastRecalcRef.current < RECALC_COOLDOWN_MS) return;
    lastRecalcRef.current = now;
    loadRoute({ latitude: location.latitude, longitude: location.longitude }, true);
  }, [offRoute, location, status, recalculating, loadRoute]);

  const derived = useMemo(() => {
    if (!route) {
      return { remainingMeters: 0, remainingSeconds: 0, progress: 0, currentStep: null, nextStep: null };
    }

    const total = route.distanceMeters;
    const traveled = snap?.traveledMeters ?? 0;
    // La polilínea puede medir algo distinto a la distancia reportada por el
    // proveedor; se escala para que el avance encaje con la cifra que se muestra.
    const polyLength = pathLengthMeters(route.polyline) || total || 1;
    const traveledScaled = (traveled / polyLength) * total;

    const straightToDestination = location ? distanceMeters(location, destination) : total;
    const remainingMeters = Math.max(
      0,
      Math.min(total - traveledScaled, Math.max(straightToDestination, 0) * 1.4),
    );

    const pace = total > 0 ? route.durationSeconds / total : 0;
    const remainingSeconds = remainingMeters * pace;
    const progress = total > 0 ? Math.min(1, traveledScaled / total) : 0;

    // Paso activo: el primero cuyo final aún no se ha alcanzado.
    let consumed = 0;
    let currentIndex = 0;
    for (let i = 0; i < route.steps.length; i++) {
      consumed += route.steps[i].distanceMeters;
      if (consumed >= traveledScaled) { currentIndex = i; break; }
      currentIndex = Math.min(i + 1, route.steps.length - 1);
    }

    return {
      remainingMeters,
      remainingSeconds,
      progress,
      currentStep: route.steps[currentIndex] ?? null,
      nextStep: route.steps[currentIndex + 1] ?? null,
    };
  }, [route, snap, location, destination]);

  // Llegada.
  useEffect(() => {
    if (!location || arrivedRef.current) return;
    if (distanceMeters(location, destination) <= ARRIVAL_RADIUS_METERS) {
      arrivedRef.current = true;
      setStatus(TripStatus.ARRIVED);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onArrive?.();
    }
  }, [location, destination, onArrive]);

  // Pasar de "planificado" a "en camino" al detectar movimiento real.
  useEffect(() => {
    if (status !== TripStatus.PLANNED || !location || !originRef.current) return;
    if (distanceMeters(location, originRef.current) > 40) setStatus(TripStatus.ACTIVE);
  }, [location, status]);

  const recalculate = useCallback(() => {
    if (!location) return;
    lastRecalcRef.current = Date.now();
    loadRoute({ latitude: location.latitude, longitude: location.longitude }, true);
  }, [location, loadRoute]);

  const stop = useCallback(() => setStatus(TripStatus.CANCELLED), []);

  const state: TripState = {
    status,
    route,
    location,
    offRoute,
    // Sin permiso y sin posición no hay nada que esperar.
    loading: loading && !(!location && permission === 'denied'),
    recalculating,
    error: error ?? locationError,
    ...derived,
  };

  return { ...state, permission, requestPermission: request, recalculate, stop };
}

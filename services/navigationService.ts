import type { Ionicons } from '@expo/vector-icons';
import { env } from '@/config/env';
import {
  bearingDegrees, decodePolyline, distanceMeters, formatDistance, interpolateGreatCircle,
  LatLng, pathLengthMeters,
} from '@/lib/geo';
import { TravelMode } from '@/domain/enums';

/** Nombre de un ícono de Ionicons; así el tipo garantiza que el ícono existe. */
export type ManeuverIcon = keyof typeof Ionicons.glyphMap;

export interface RouteStep {
  /** Instrucción en español, sin etiquetas HTML. */
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  /** Coordenada donde empieza el paso; sirve para resaltar el paso actual. */
  start: LatLng;
  end: LatLng;
  /** Icono de maniobra (`arrow-forward`, `return-up-back`…). */
  maneuver: ManeuverIcon;
}

export interface Route {
  polyline: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
  /** `google` cuando viene de la Directions API; `estimated` si se calculó local. */
  source: 'google' | 'estimated';
  /** Resumen de vías, cuando el proveedor lo entrega. */
  summary?: string;
  fetchedAt: number;
}

/** Velocidades medias urbanas (m/s) para la estimación sin proveedor externo. */
const FALLBACK_SPEED: Record<TravelMode, number> = {
  [TravelMode.DRIVING]: 7.2,     // ~26 km/h en ciudad con semáforos
  [TravelMode.MOTORCYCLE]: 8.6,  // ~31 km/h
  [TravelMode.WALKING]: 1.35,    // ~4,9 km/h
};

/**
 * Factor de rodeo: las calles no van en línea recta. 1,35 es el valor que mejor
 * aproxima trayectos urbanos en retícula frente a la distancia en línea recta.
 */
const DETOUR_FACTOR = 1.35;

const GOOGLE_MODE: Record<TravelMode, string> = {
  [TravelMode.DRIVING]: 'driving',
  [TravelMode.MOTORCYCLE]: 'driving',
  [TravelMode.WALKING]: 'walking',
};

const MANEUVER_ICONS: Record<string, ManeuverIcon> = {
  'turn-right': 'arrow-forward', 'turn-left': 'arrow-back',
  'turn-slight-right': 'arrow-forward', 'turn-slight-left': 'arrow-back',
  'turn-sharp-right': 'return-up-forward', 'turn-sharp-left': 'return-up-back',
  'uturn-right': 'return-down-back', 'uturn-left': 'return-down-back',
  'roundabout-right': 'sync', 'roundabout-left': 'sync',
  'merge': 'git-merge-outline', 'fork-right': 'git-branch-outline',
  'fork-left': 'git-branch-outline', 'ramp-right': 'trending-up',
  'ramp-left': 'trending-up', 'straight': 'arrow-up', 'ferry': 'boat-outline',
};

export const navigationService = {
  /**
   * Ruta entre dos puntos.
   *
   * Con clave de la Directions API se obtiene el trazado real por calles y las
   * indicaciones paso a paso. Sin ella —o si la petición falla— se devuelve una
   * ruta estimada: geometría de círculo máximo, distancia corregida con el
   * factor de rodeo y un único paso. La app funciona igual; sólo pierde
   * precisión, y la interfaz lo indica con una etiqueta "aproximada".
   */
  async getRoute(
    origin: LatLng,
    destination: LatLng,
    mode: TravelMode = TravelMode.DRIVING,
  ): Promise<Route> {
    if (env.googleDirectionsKey) {
      try {
        const route = await fetchGoogleRoute(origin, destination, mode, env.googleDirectionsKey);
        if (route) return route;
      } catch {
        // Sin red o cuota agotada: seguimos con la estimación local.
      }
    }
    return estimateRoute(origin, destination, mode);
  },

  /** URL para abrir el trayecto en la app de mapas del sistema. */
  externalNavigationUrl(destination: LatLng, label: string, platform: 'ios' | 'android' | 'web'): string {
    const { latitude, longitude } = destination;
    const name = encodeURIComponent(label);
    if (platform === 'ios') {
      return `maps://?daddr=${latitude},${longitude}&q=${name}&dirflg=d`;
    }
    if (platform === 'android') {
      return `google.navigation:q=${latitude},${longitude}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  },
};

async function fetchGoogleRoute(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode,
  key: string,
): Promise<Route | null> {
  const params = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    mode: GOOGLE_MODE[mode],
    language: 'es',
    region: 'co',
    departure_time: 'now',
    key,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params}`,
      { signal: controller.signal },
    );
    // Un 4xx/5xx (clave inválida, cuota agotada) cae a la estimación local.
    if (!response.ok) return null;
    const json = await response.json();
    if (json.status !== 'OK' || !json.routes?.length) return null;

    const route = json.routes[0];
    const leg = route.legs[0];

    return {
      polyline: decodePolyline(route.overview_polyline.points),
      distanceMeters: leg.distance.value,
      // `duration_in_traffic` sólo llega con `departure_time`; es la buena.
      durationSeconds: leg.duration_in_traffic?.value ?? leg.duration.value,
      summary: route.summary,
      source: 'google',
      fetchedAt: Date.now(),
      steps: (leg.steps ?? []).map((step: any): RouteStep => ({
        instruction: stripHtml(step.html_instructions ?? ''),
        distanceMeters: step.distance?.value ?? 0,
        durationSeconds: step.duration?.value ?? 0,
        start: { latitude: step.start_location.lat, longitude: step.start_location.lng },
        end: { latitude: step.end_location.lat, longitude: step.end_location.lng },
        maneuver: MANEUVER_ICONS[step.maneuver] ?? 'arrow-up',
      })),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function estimateRoute(origin: LatLng, destination: LatLng, mode: TravelMode): Route {
  const polyline = interpolateGreatCircle(origin, destination, 32);
  const straight = pathLengthMeters(polyline);
  const distance = straight * DETOUR_FACTOR;
  const duration = distance / FALLBACK_SPEED[mode];
  const heading = bearingDegrees(origin, destination);

  return {
    polyline,
    distanceMeters: distance,
    durationSeconds: duration,
    source: 'estimated',
    fetchedAt: Date.now(),
    steps: [{
      instruction: `Dirígete hacia el ${compassLabel(heading)} durante ${formatDistance(distance)}`,
      distanceMeters: distance,
      durationSeconds: duration,
      start: origin,
      end: destination,
      maneuver: 'navigate-outline',
    }],
  };
}

function compassLabel(degrees: number): string {
  const names = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
  return names[Math.round(degrees / 45) % 8];
}

function stripHtml(html: string): string {
  return html
    .replace(/<div[^>]*>/gi, ' · ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distancia a la que se considera que el vehículo llegó al parqueadero. */
export const ARRIVAL_RADIUS_METERS = 80;

/** Separación de la ruta a partir de la cual se recalcula el trayecto. */
export const OFF_ROUTE_THRESHOLD_METERS = 70;

export { distanceMeters };

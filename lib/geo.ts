/** Utilidades geográficas: distancias, rumbos, proyección sobre la ruta y formato. */

export interface LatLng { latitude: number; longitude: number }

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Distancia sobre la superficie terrestre, en metros (fórmula del haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rumbo inicial de `a` a `b`, en grados desde el norte. */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.latitude), lat2 = toRad(b.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Longitud total de una polilínea, en metros. */
export function pathLengthMeters(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceMeters(path[i - 1], path[i]);
  return total;
}

export interface SnapResult {
  /** Índice del vértice inicial del segmento más cercano. */
  index: number;
  /** Punto de la ruta más cercano a la posición dada. */
  point: LatLng;
  /** Separación perpendicular respecto a la ruta, en metros. */
  offsetMeters: number;
  /** Metros recorridos desde el inicio de la ruta hasta ese punto. */
  traveledMeters: number;
}

/**
 * Proyecta una posición sobre la polilínea de la ruta.
 *
 * Es la base del seguimiento: con el punto proyectado se sabe cuánto falta, y
 * con `offsetMeters` se detecta que el conductor se ha salido del camino.
 *
 * Para distancias urbanas se trabaja en un plano equirrectangular local: el
 * error frente al cálculo esférico es de centímetros y evita trigonometría
 * pesada en cada actualización del GPS.
 */
export function snapToPath(position: LatLng, path: LatLng[]): SnapResult | null {
  if (path.length === 0) return null;
  if (path.length === 1) {
    return {
      index: 0, point: path[0],
      offsetMeters: distanceMeters(position, path[0]),
      traveledMeters: 0,
    };
  }

  const latScale = EARTH_RADIUS_M * (Math.PI / 180);
  const lngScale = latScale * Math.cos(toRad(position.latitude));
  const toXY = (p: LatLng) => ({ x: p.longitude * lngScale, y: p.latitude * latScale });

  const P = toXY(position);
  let best: SnapResult | null = null;
  let cumulative = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const A = toXY(path[i]);
    const B = toXY(path[i + 1]);
    const ABx = B.x - A.x, ABy = B.y - A.y;
    const segLen2 = ABx * ABx + ABy * ABy;
    const segLen = Math.sqrt(segLen2);

    // Parámetro del punto más cercano sobre el segmento, recortado a [0, 1].
    const tRaw = segLen2 === 0 ? 0 : ((P.x - A.x) * ABx + (P.y - A.y) * ABy) / segLen2;
    const t = Math.min(1, Math.max(0, tRaw));

    const closest = {
      latitude: path[i].latitude + (path[i + 1].latitude - path[i].latitude) * t,
      longitude: path[i].longitude + (path[i + 1].longitude - path[i].longitude) * t,
    };
    const offset = Math.hypot(P.x - (A.x + ABx * t), P.y - (A.y + ABy * t));

    if (!best || offset < best.offsetMeters) {
      best = { index: i, point: closest, offsetMeters: offset, traveledMeters: cumulative + segLen * t };
    }
    cumulative += segLen;
  }

  return best;
}

/**
 * Decodifica el formato *encoded polyline* de Google (precisión 5).
 * Es como la Directions API devuelve la geometría de la ruta.
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    for (const axis of ['lat', 'lng'] as const) {
      let result = 0, shift = 0, byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      // Bit bajo = signo; el valor va en zigzag.
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 'lat') lat += delta; else lng += delta;
    }
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}

/**
 * Interpola puntos intermedios entre dos coordenadas siguiendo el círculo
 * máximo. Se usa en el modo sin conexión a la Directions API, para que la línea
 * de la ruta se curve con el mapa en lugar de cortar en recta.
 */
export function interpolateGreatCircle(a: LatLng, b: LatLng, segments = 24): LatLng[] {
  const lat1 = toRad(a.latitude), lng1 = toRad(a.longitude);
  const lat2 = toRad(b.latitude), lng2 = toRad(b.longitude);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2
  ));
  if (d === 0 || !Number.isFinite(d)) return [a, b];

  const out: LatLng[] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    out.push({
      latitude: toDeg(Math.atan2(z, Math.hypot(x, y))),
      longitude: toDeg(Math.atan2(y, x)),
    });
  }
  return out;
}

/** Región de mapa que encuadra todos los puntos, con margen proporcional. */
export function regionForPoints(points: LatLng[], paddingRatio = 0.35) {
  if (points.length === 0) {
    return { latitude: 6.2442, longitude: -75.5812, latitudeDelta: 0.08, longitudeDelta: 0.08 };
  }
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.004, (maxLat - minLat) * (1 + paddingRatio)),
    longitudeDelta: Math.max(0.004, (maxLng - minLng) * (1 + paddingRatio)),
  };
}

// ─── Formato ──────────────────────────────────────────────────────────────────

/** `820 m`, `3,4 km`. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`;
}

/** `7 min`, `1 h 12 min`. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return 'menos de 1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Hora de llegada estimada, `14:35`. */
export function formatEta(secondsFromNow: number, now = new Date()): string {
  const eta = new Date(now.getTime() + Math.max(0, secondsFromNow) * 1000);
  return eta.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

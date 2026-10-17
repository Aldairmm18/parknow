/**
 * Motor 3D mínimo que dibuja sobre `react-native-svg`.
 *
 * ¿Por qué no three.js? `expo-gl` + `expo-three` obliga a un development build
 * y arrastra ~2 MB de dependencia nativa para dibujar cajas. Aquí la escena es
 * geometría simple (prismas rectangulares), así que sale más barato proyectar
 * a mano y emitir polígonos SVG: funciona en Expo Go, en web y en cualquier
 * build sin configuración nativa extra.
 *
 * Lo que sí es 3D de verdad: coordenadas en el espacio, cámara orbital con
 * rotación por matrices, proyección en perspectiva con división por la
 * profundidad, recorte del plano cercano, orden de pintor por profundidad y
 * sombreado lambertiano por normal de cara.
 *
 * Sistema de coordenadas (mano derecha):
 *   +X → derecha,  +Y → arriba,  +Z → hacia el espectador.
 */

export interface Vec3 { x: number; y: number; z: number }
export interface Vec2 { x: number; y: number }

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const scale = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

export const cross = (a: Vec3, b: Vec3): Vec3 =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

export function normalize(a: Vec3): Vec3 {
  const len = Math.hypot(a.x, a.y, a.z);
  return len === 0 ? v3(0, 0, 0) : scale(a, 1 / len);
}

// ─── Cámara ───────────────────────────────────────────────────────────────────

export interface CameraOptions {
  /** Giro alrededor del eje vertical, en radianes. */
  yaw: number;
  /** Inclinación (mirar desde arriba), en radianes. Se recorta a [0.08, 1.45]. */
  pitch: number;
  /** Distancia de la cámara al centro de la escena, en unidades del mundo. */
  distance: number;
  /** Campo de visión vertical, en radianes. */
  fov?: number;
  /** Punto al que orbita la cámara. */
  target?: Vec3;
  width: number;
  height: number;
}

export interface Projected extends Vec2 {
  /** Profundidad en espacio de cámara: mayor = más lejos. */
  depth: number;
  /** `false` si el punto queda detrás del plano cercano. */
  visible: boolean;
}

export interface Camera {
  project: (p: Vec3) => Projected;
  /** Posición de la cámara en el mundo; necesaria para el descarte de caras. */
  position: Vec3;
  options: Required<CameraOptions>;
}

export const PITCH_MIN = 0.08;
export const PITCH_MAX = 1.45;
const NEAR = 0.1;

export function createCamera(opts: CameraOptions): Camera {
  const fov = opts.fov ?? Math.PI / 4;
  const target = opts.target ?? v3(0, 0, 0);
  const pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, opts.pitch));
  const { yaw, distance, width, height } = opts;

  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);

  // Distancia focal en píxeles: proyecta media altura del encuadre al plano.
  const focal = (height / 2) / Math.tan(fov / 2);
  const cx = width / 2;
  const cy = height / 2;

  // La cámara orbita el objetivo; su posición se obtiene invirtiendo la
  // rotación que aplicamos al mundo.
  const position = add(target, v3(
    distance * cosP * sinY,
    distance * sinP,
    distance * cosP * cosY,
  ));

  const project = (p: Vec3): Projected => {
    // Al espacio del objetivo.
    const x0 = p.x - target.x, y0 = p.y - target.y, z0 = p.z - target.z;

    // Giro alrededor de +Y.
    const x1 = x0 * cosY - z0 * sinY;
    const z1 = x0 * sinY + z0 * cosY;

    // Inclinación alrededor de +X.
    const y2 = y0 * cosP - z1 * sinP;
    const z2 = y0 * sinP + z1 * cosP;

    // Alejar la escena de la cámara.
    const depth = distance - z2;

    if (depth <= NEAR) {
      return { x: cx, y: cy, depth: NEAR, visible: false };
    }

    const s = focal / depth;
    return { x: cx + x1 * s, y: cy - y2 * s, depth, visible: true };
  };

  return { project, position, options: { ...opts, fov, target, pitch } };
}

// ─── Caras ────────────────────────────────────────────────────────────────────

export interface Face<M = unknown> {
  /** Vértices en orden antihorario vistos desde fuera del sólido. */
  points: Vec3[];
  color: string;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number;
  /** Datos propios (p. ej. el id del espacio) para el manejo del toque. */
  meta?: M;
  /** Excluye la cara del sombreado; útil para marcas pintadas en el suelo. */
  unlit?: boolean;
  /** Se dibuja siempre encima, sin importar la profundidad (etiquetas). */
  overlay?: boolean;
}

export interface RenderedFace<M = unknown> {
  /** Cadena lista para el atributo `points` de `<Polygon>`. */
  points: string;
  polygon: Vec2[];
  fill: string;
  opacity: number;
  stroke?: string;
  strokeWidth?: number;
  meta?: M;
  depth: number;
  key: string;
}

/** Normal de la cara a partir de sus tres primeros vértices. */
export function faceNormal(points: Vec3[]): Vec3 {
  if (points.length < 3) return v3(0, 1, 0);
  return normalize(cross(sub(points[1], points[0]), sub(points[2], points[0])));
}

export function centroid(points: Vec3[]): Vec3 {
  const sum = points.reduce((acc, p) => add(acc, p), v3(0, 0, 0));
  return scale(sum, 1 / points.length);
}

export interface ShadeOptions {
  /** Dirección *hacia* la luz. Se normaliza internamente. */
  lightDirection?: Vec3;
  /** Luz de relleno mínima, 0–1: evita que las caras en sombra se vean negras. */
  ambient?: number;
  /** Función de mezcla de color; inyectada para no acoplar el motor al tema. */
  mix: (from: string, to: string, t: number) => string;
}

const DEFAULT_LIGHT = normalize(v3(-0.45, 1, 0.55));

/**
 * Proyecta, ilumina y ordena una lista de caras.
 *
 * El orden de pintor (dibujar de atrás hacia adelante) basta aquí porque la
 * escena son prismas separados sobre un plano: no hay geometría que se
 * interpenetre, que es el caso donde este algoritmo falla.
 */
export function renderFaces<M>(
  faces: Face<M>[],
  camera: Camera,
  shade: ShadeOptions,
): RenderedFace<M>[] {
  const light = normalize(shade.lightDirection ?? DEFAULT_LIGHT);
  const ambient = shade.ambient ?? 0.55;
  const out: RenderedFace<M>[] = [];

  faces.forEach((face, index) => {
    const projected = face.points.map(camera.project);
    if (projected.some((p) => !p.visible)) return;

    const c = centroid(face.points);

    let fill = face.color;
    if (!face.unlit) {
      const n = faceNormal(face.points);
      // Lambert: la cara recibe luz según el coseno del ángulo con la fuente.
      const lambert = Math.max(0, dot(n, light));
      const intensity = ambient + (1 - ambient) * lambert;
      fill = intensity >= 1
        ? face.color
        : shade.mix(face.color, '#0B0C10', (1 - intensity) * 0.85);
    }

    out.push({
      points: projected.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
      polygon: projected.map((p) => ({ x: p.x, y: p.y })),
      fill,
      opacity: face.opacity ?? 1,
      stroke: face.stroke,
      strokeWidth: face.strokeWidth,
      meta: face.meta,
      // Las overlays se fuerzan al frente con profundidad negativa.
      depth: face.overlay ? -1 : Math.max(...projected.map((p) => p.depth)) * 0.5
        + camera.project(c).depth * 0.5,
      key: `f${index}`,
    });
  });

  // Orden de pintor: lo más lejano primero.
  return out.sort((a, b) => b.depth - a.depth);
}

// ─── Constructores de geometría ───────────────────────────────────────────────

/**
 * Caras visibles de un prisma rectangular alineado a los ejes.
 *
 * Se omite la cara inferior (nunca se ve, la cámara siempre está por encima) y
 * las caras traseras se descartan comparando su normal con la dirección a la
 * cámara: menos polígonos que ordenar y dibujar.
 */
export function box<M>(opts: {
  /** Esquina inferior, centrada en X y Z. */
  center: Vec3;
  size: Vec3;
  color: string;
  /** Color del techo; por defecto, el mismo del cuerpo. */
  topColor?: string;
  meta?: M;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number;
  camera?: Camera;
}): Face<M>[] {
  const { center, size, color, topColor, meta, opacity, stroke, strokeWidth, camera } = opts;
  const hx = size.x / 2, hz = size.z / 2;
  const y0 = center.y, y1 = center.y + size.y;
  const { x, z } = center;

  const p = (px: number, py: number, pz: number) => v3(x + px, py, z + pz);

  const candidates: Face<M>[] = [
    // Techo (antihorario visto desde arriba).
    { points: [p(-hx, y1, -hz), p(-hx, y1, hz), p(hx, y1, hz), p(hx, y1, -hz)], color: topColor ?? color },
    // Frente (+Z).
    { points: [p(-hx, y0, hz), p(hx, y0, hz), p(hx, y1, hz), p(-hx, y1, hz)], color },
    // Fondo (−Z).
    { points: [p(hx, y0, -hz), p(-hx, y0, -hz), p(-hx, y1, -hz), p(hx, y1, -hz)], color },
    // Derecha (+X).
    { points: [p(hx, y0, hz), p(hx, y0, -hz), p(hx, y1, -hz), p(hx, y1, hz)], color },
    // Izquierda (−X).
    { points: [p(-hx, y0, -hz), p(-hx, y0, hz), p(-hx, y1, hz), p(-hx, y1, -hz)], color },
  ].map((f) => ({ ...f, meta, opacity, stroke, strokeWidth }));

  if (!camera) return candidates;

  // Descarte de caras traseras.
  return candidates.filter((f) => {
    const toCamera = sub(camera.position, centroid(f.points));
    return dot(faceNormal(f.points), toCamera) > 0;
  });
}

/** Rectángulo horizontal a la altura `y`: suelo, plazas y líneas pintadas. */
export function plane<M>(opts: {
  center: Vec3;
  width: number;
  depth: number;
  color: string;
  meta?: M;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number;
  unlit?: boolean;
}): Face<M> {
  const { center, width, depth, color, meta, opacity, stroke, strokeWidth, unlit } = opts;
  const hx = width / 2, hz = depth / 2;
  return {
    points: [
      v3(center.x - hx, center.y, center.z - hz),
      v3(center.x - hx, center.y, center.z + hz),
      v3(center.x + hx, center.y, center.z + hz),
      v3(center.x + hx, center.y, center.z - hz),
    ],
    color, meta, opacity, stroke, strokeWidth, unlit,
  };
}

/** ¿El punto 2D cae dentro del polígono? Regla par-impar por lanzamiento de rayo. */
export function pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const { x: xi, y: yi } = polygon[i];
    const { x: xj, y: yj } = polygon[j];
    const intersects = yi > point.y !== yj > point.y
      && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Cara golpeada por un toque. Recorre de adelante hacia atrás para que gane la
 * que el usuario ve encima, no la que está oculta detrás.
 */
export function hitTest<M>(point: Vec2, faces: RenderedFace<M>[]): RenderedFace<M> | null {
  for (let i = faces.length - 1; i >= 0; i--) {
    if (faces[i].meta != null && pointInPolygon(point, faces[i].polygon)) return faces[i];
  }
  return null;
}

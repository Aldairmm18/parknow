import { SpotKind, SpotStatus, VehicleType } from './enums';

/**
 * Plano de un piso en coordenadas del mundo (metros), listo para el motor 3D.
 *
 * El plano se **deriva** de la capacidad del parqueadero con un generador
 * determinista: el mismo parqueadero produce siempre la misma distribución, así
 * que el espacio 14 de la planta 2 está en el mismo sitio entre sesiones y
 * entre dispositivos. Cuando el operador cargue planos reales en la base de
 * datos, `parkingService.getFloorPlan` los usará en lugar del generador.
 */

export interface Spot {
  /** Identificador estable: `P2-A07`. */
  id: string;
  /** Etiqueta corta para la interfaz: `A07`. */
  label: string;
  floor: number;
  row: number;
  column: number;
  kind: SpotKind;
  status: SpotStatus;
  /** Centro del espacio en el plano del piso, en metros. */
  x: number;
  z: number;
  width: number;
  depth: number;
  /** Rotación en radianes; 0 = el vehículo entra desde +Z. */
  rotation: number;
  /** Distancia a pie hasta la salida peatonal, en metros. */
  walkToExit: number;
  /**
   * Correlativo del espacio dentro del parqueadero (no dentro de la planta).
   * Es el valor que se guarda en `reservations.assigned_spot`.
   */
  number?: number;
}

export interface FloorPlan {
  floor: number;
  label: string;
  spots: Spot[];
  /** Extensión del piso, en metros. */
  width: number;
  depth: number;
  /** Carriles de circulación, para dibujar el asfalto y las flechas. */
  aisles: { z: number; width: number }[];
  /** Punto de entrada de vehículos (rampa). */
  entrance: { x: number; z: number };
  /** Salida peatonal (ascensores/escaleras). */
  pedestrianExit: { x: number; z: number };
}

const SPOT_WIDTH = 2.5;
const SPOT_DEPTH = 5.0;
const MOTO_WIDTH = 1.3;
const MOTO_DEPTH = 2.4;
const AISLE_WIDTH = 6.0;
const GAP = 0.12;

/** Número de columnas por fila; acota el ancho del piso a algo dibujable. */
const COLUMNS_PER_ROW = 10;
/** Cada "banda" es una fila de espacios; dos bandas comparten un carril. */
const BANDS_PER_FLOOR = 4;

export const SPOTS_PER_FLOOR = COLUMNS_PER_ROW * BANDS_PER_FLOOR;

const COLUMN_LETTERS = 'ABCDEFGH';

/**
 * Reparte la capacidad total en pisos. Un parqueadero de 120 cupos da 3 plantas
 * de 40, no una explanada imposible de leer en pantalla.
 */
export function floorCountFor(totalCapacity: number): number {
  return Math.max(1, Math.min(6, Math.ceil(totalCapacity / SPOTS_PER_FLOOR)));
}

/**
 * Tipo de espacio por posición. Las plazas accesibles van pegadas a la salida
 * peatonal (como manda cualquier normativa), las de carga eléctrica en la
 * primera banda y las motos en la última.
 */
function kindFor(band: number, column: number, bands: number): SpotKind {
  if (band === bands - 1) return SpotKind.MOTORCYCLE;
  if (band === 0 && column < 2) return SpotKind.EV;
  if (band === 0 && column >= COLUMNS_PER_ROW - 2) return SpotKind.ACCESSIBLE;
  if (column === 0 || column === COLUMNS_PER_ROW - 1) return SpotKind.COMPACT;
  return SpotKind.STANDARD;
}

/**
 * Genera el plano de un piso.
 *
 * @param floor      Número de planta, empezando en 1.
 * @param capacity   Cupos a colocar en esta planta.
 * @param seed       Semilla estable (el id del parqueadero) para los bloqueos.
 */
export function buildFloorPlan(floor: number, capacity: number, seed: string): FloorPlan {
  const bands = Math.max(1, Math.min(BANDS_PER_FLOOR, Math.ceil(capacity / COLUMNS_PER_ROW)));
  const spots: Spot[] = [];
  const aisles: { z: number; width: number }[] = [];

  const rowPitch = SPOT_DEPTH + GAP;
  // Dos bandas por carril: banda, carril, banda | banda, carril, banda…
  const groupDepth = rowPitch * 2 + AISLE_WIDTH;
  const groups = Math.ceil(bands / 2);
  const totalDepth = groups * groupDepth;
  const totalWidth = COLUMNS_PER_ROW * (SPOT_WIDTH + GAP) + 3;

  const pedestrianExit = { x: -totalWidth / 2 + 1.6, z: -totalDepth / 2 + 1.6 };
  const entrance = { x: totalWidth / 2 - 2.2, z: totalDepth / 2 - 1.2 };

  let placed = 0;

  for (let band = 0; band < bands && placed < capacity; band++) {
    const group = Math.floor(band / 2);
    const isUpperBand = band % 2 === 0;
    const groupTop = -totalDepth / 2 + group * groupDepth;

    // La banda superior mira hacia abajo (+Z), la inferior hacia arriba (−Z);
    // entre ambas queda el carril de circulación.
    const z = isUpperBand
      ? groupTop + rowPitch / 2
      : groupTop + rowPitch * 1.5 + AISLE_WIDTH;
    const rotation = isUpperBand ? 0 : Math.PI;

    if (isUpperBand) {
      aisles.push({ z: groupTop + rowPitch + AISLE_WIDTH / 2, width: AISLE_WIDTH });
    }

    for (let column = 0; column < COLUMNS_PER_ROW && placed < capacity; column++) {
      const kind = kindFor(band, column, bands);
      const isMoto = kind === SpotKind.MOTORCYCLE;
      const width = isMoto ? MOTO_WIDTH : kind === SpotKind.COMPACT ? SPOT_WIDTH * 0.85 : SPOT_WIDTH;
      const depth = isMoto ? MOTO_DEPTH : SPOT_DEPTH;

      const x = -totalWidth / 2 + 1.5 + column * (SPOT_WIDTH + GAP) + SPOT_WIDTH / 2;

      // Un puñado de espacios fuera de servicio, estables por parqueadero.
      const blocked = hash(`${seed}:${floor}:${band}:${column}`) % 23 === 0;

      spots.push({
        id: `P${floor}-${COLUMN_LETTERS[band]}${String(column + 1).padStart(2, '0')}`,
        label: `${COLUMN_LETTERS[band]}${String(column + 1).padStart(2, '0')}`,
        floor,
        row: band,
        column,
        kind,
        status: blocked ? SpotStatus.BLOCKED : SpotStatus.FREE,
        x,
        z,
        width,
        depth,
        rotation,
        walkToExit: Math.round(Math.hypot(x - pedestrianExit.x, z - pedestrianExit.z)),
      });
      placed++;
    }
  }

  return {
    floor,
    label: floorLabelFor(floor),
    spots,
    width: totalWidth,
    depth: totalDepth,
    aisles,
    entrance,
    pedestrianExit,
  };
}

/** Nombre de una planta tal como aparece en el selector: `Planta baja`, `Piso 2`… */
export function floorLabelFor(floor: number): string {
  return floor === 1 ? 'Planta baja' : `Piso ${floor}`;
}

/**
 * Etiqueta visible (`C05`) a partir del correlativo guardado en
 * `reservations.assigned_spot`. Es la inversa de la numeración de
 * `parkingService.getFloorPlans`: (planta − 1) · 40 + banda · 10 + columna + 1.
 */
export function spotLabelFor(number: number): string {
  const index = (number - 1) % SPOTS_PER_FLOOR;
  const band = Math.floor(index / COLUMNS_PER_ROW);
  const column = index % COLUMNS_PER_ROW;
  return `${COLUMN_LETTERS[band]}${String(column + 1).padStart(2, '0')}`;
}

/** Planos de todas las plantas de un parqueadero. */
export function buildFloorPlans(totalCapacity: number, seed: string): FloorPlan[] {
  const floors = floorCountFor(totalCapacity);
  const plans: FloorPlan[] = [];
  let remaining = totalCapacity;
  for (let f = 1; f <= floors; f++) {
    const capacity = Math.min(SPOTS_PER_FLOOR, remaining);
    plans.push(buildFloorPlan(f, capacity, seed));
    remaining -= capacity;
  }
  return plans;
}

/** ¿El tipo de espacio admite este vehículo? */
export function spotAcceptsVehicle(kind: SpotKind, vehicle: VehicleType): boolean {
  if (vehicle === VehicleType.MOTORCYCLE) return kind === SpotKind.MOTORCYCLE;
  return kind !== SpotKind.MOTORCYCLE;
}

/** Hash determinista de 32 bits (FNV-1a) para decisiones estables por semilla. */
export function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

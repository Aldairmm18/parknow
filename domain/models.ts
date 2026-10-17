import {
  AuthProvider, PaymentStatus, PaymentType, QRPurpose, ReservationStatus,
  UserStatus, VehicleType,
} from './enums';

export interface User {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  avatarUrl?: string;
  /** Con qué proveedor se creó la cuenta. */
  authProvider: AuthProvider;
  /** Momento en que se aceptaron los Términos; requisito legal de trazabilidad. */
  acceptedTermsAt?: string;
  /** Consentimiento explícito para comunicaciones comerciales (opt-in). */
  marketingOptIn: boolean;
  /** Fecha en que se solicitó el borrado de la cuenta, si aplica. */
  deletionRequestedAt?: string;
}

export interface ParkingLot {
  id: string;
  tenantId: string;
  name: string;
  totalCapacity: number;
  carCapacity: number;
  motoCapacity: number;
  pricePerBlock: number;
  address: string;
  latitude?: number;
  longitude?: number;
  /** Número de plantas; si no viene, se deduce de la capacidad. */
  floors?: number;
  /** Servicios del parqueadero: `cubierto`, `vigilancia`, `carga_ev`… */
  amenities: string[];
  /** Horario de apertura, en formato `HH:mm`. */
  opensAt?: string;
  closesAt?: string;
  /** Valoración media, 0–5. */
  rating?: number;
}

/** Parqueadero con disponibilidad y, si hay ubicación, distancia al usuario. */
export interface ParkingLotWithAvailability extends ParkingLot {
  availableSlots: number;
  /** Metros en línea recta hasta el usuario. */
  distanceMeters?: number;
  /** Ocupación actual en porcentaje, 0–100. */
  occupancyPercent: number;
}

export interface TimeSlot {
  id: string;
  parkingLotId: string;
  startsAt: string;
  endsAt: string;
  availableCapacity: number;
  pricePerBlock?: number;
}

export interface Reservation {
  id: string;
  parkingLotId: string;
  vehiclePlate: string;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  arrivalDeadlineAt: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  createdAt: string;
  assignedFloor?: number;
  assignedSpot?: number;
  vehicleType?: VehicleType;
}

export interface QRToken {
  id: string;
  reservationId: string;
  tokenHash: string;
  purpose: QRPurpose;
  expiresAt: string;
  usedAt?: string;
}

export interface Payment {
  id: string;
  reservationId: string;
  type: PaymentType;
  amount: number;
  status: PaymentStatus;
  createdAt: string;
}

export interface CheckEvent {
  id: string;
  reservationId: string;
  edgeDeviceId?: string;
  type: QRPurpose;
  result: string;
  reason?: string;
  eventAt: string;
}

/** Trayecto guardado: histórico de "cómo llegué" ligado a la reserva. */
export interface Trip {
  id: string;
  reservationId: string;
  startedAt: string;
  arrivedAt?: string;
  distanceMeters: number;
  durationSeconds: number;
  /** Proveedor que calculó la ruta. */
  routeSource: 'google' | 'estimated';
}

export type ScreenState<T> = {
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: T;
  error?: string;
};

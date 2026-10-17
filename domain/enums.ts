export enum VehicleType {
  CAR        = 'CAR',
  MOTORCYCLE = 'MOTORCYCLE',
}

export enum OwnerType {
  USER   = 'USER',
  CLIENT = 'CLIENT',
}

export enum UserStatus {
  ACTIVE   = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum ReservationStatus {
  RESERVED   = 'RESERVED',
  CHECKED_IN = 'CHECKED_IN',
  COMPLETED  = 'COMPLETED',
  EXPIRED    = 'EXPIRED',
  OVERSTAY   = 'OVERSTAY',
  CANCELLED  = 'CANCELLED',
}

export enum QRPurpose {
  ENTRY = 'ENTRY',
  EXIT  = 'EXIT',
}

export enum PaymentType {
  RESERVATION = 'RESERVATION',
  REFUND      = 'REFUND',
  EXTENSION   = 'EXTENSION',
  PENALTY     = 'PENALTY',
}

export enum PaymentStatus {
  PENDING  = 'PENDING',
  SUCCESS  = 'SUCCESS',
  FAILED   = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum DeviceStatus {
  ONLINE  = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

export enum EventResult {
  SUCCESS = 'SUCCESS',
  FAILED  = 'FAILED',
}

export enum SpotStatus {
  /** Libre en el rango horario consultado. */
  FREE      = 'FREE',
  /** Ya reservado por otra persona. */
  TAKEN     = 'TAKEN',
  /** Fuera de servicio (mantenimiento, obstruido). */
  BLOCKED   = 'BLOCKED',
  /** El espacio de la reserva propia que se está mirando. */
  MINE      = 'MINE',
}

export enum SpotKind {
  STANDARD   = 'STANDARD',
  COMPACT    = 'COMPACT',
  MOTORCYCLE = 'MOTORCYCLE',
  ACCESSIBLE = 'ACCESSIBLE',
  EV         = 'EV',
}

export enum AuthProvider {
  EMAIL    = 'EMAIL',
  GOOGLE   = 'GOOGLE',
  FACEBOOK = 'FACEBOOK',
  APPLE    = 'APPLE',
}

export enum TripStatus {
  /** Ruta calculada, aún sin salir. */
  PLANNED   = 'PLANNED',
  /** Siguiendo la ruta con la ubicación en vivo. */
  ACTIVE    = 'ACTIVE',
  /** Dentro del radio de llegada del parqueadero. */
  ARRIVED   = 'ARRIVED',
  /** El usuario detuvo el seguimiento. */
  CANCELLED = 'CANCELLED',
}

export enum TravelMode {
  DRIVING   = 'DRIVING',
  MOTORCYCLE = 'MOTORCYCLE',
  WALKING   = 'WALKING',
}

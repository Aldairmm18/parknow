import { addMinutes, differenceInMinutes, parseISO } from 'date-fns';
import * as Crypto from 'expo-crypto';
import { reservationRepository } from '@/repositories/reservationRepository';
import { parkingRepository } from '@/repositories/parkingRepository';
import { Reservation, QRToken } from '@/domain/models';
import { ReservationStatus, QRPurpose, PaymentType, PaymentStatus, VehicleType } from '@/domain/enums';

/** Minutos de cortesía para llegar antes de que la reserva expire. */
export const ARRIVAL_GRACE_MINUTES = 25;

/** Minutos de tolerancia a la salida antes de cobrar tiempo extra. */
export const OVERSTAY_GRACE_MINUTES = 10;

/** Antelación mínima para cancelar con reembolso. */
export const CANCELLATION_CUTOFF_MINUTES = 30;

/**
 * Token del QR: 32 bytes aleatorios en hexadecimal.
 *
 * El formato anterior era `QR-ENTRY-<id de reserva>-<marca de tiempo>`, que es
 * adivinable para quien conozca el id de una reserva. Un token aleatorio no
 * guarda relación con la reserva y sólo sirve una vez.
 */
async function generateQrToken(purpose: QRPurpose): Promise<string> {
  const bytes = Crypto.getRandomBytes(32);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${purpose}.${hex}`;
}

/** Placa sin espacios ni guiones y en mayúsculas, como la leen las cámaras. */
function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[\s-]/g, '').trim();
}

/**
 * Descuenta un cupo de cada bloque, todos a la vez. Cada RPC es atómico; si
 * alguno falla, se devuelven los que sí se descontaron y se propaga el error,
 * así nunca queda un cupo vendido a nadie.
 */
async function takeSlots(slotIds: string[]): Promise<void> {
  const results = await Promise.allSettled(slotIds.map((id) => parkingRepository.decrementCapacity(id)));
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (!failed) return;
  await releaseSlots(slotIds.filter((_, i) => results[i].status === 'fulfilled'));
  throw failed.reason;
}

/** Devuelve un cupo a cada bloque. Un fallo aislado no impide devolver los demás. */
async function releaseSlots(slotIds: string[]): Promise<void> {
  await Promise.all(slotIds.map((id) => parkingRepository.incrementCapacity(id).catch(() => {})));
}

export const reservationService = {
  /**
   * Crea la reserva completa: valida cupos, descuenta capacidad, asigna el
   * espacio físico, emite el QR de entrada y registra el pago.
   *
   * Si algo falla a mitad, los cupos ya descontados se devuelven. No es una
   * transacción real —eso exige una función en el servidor, ver
   * `supabase/schema.sql`— pero evita que un fallo de red deje bloqueados
   * cupos que nadie está usando.
   */
  async createReservation(params: {
    parkingLotId: string;
    vehiclePlate: string;
    vehicleType: VehicleType;
    selectedSlots: { id: string; startsAt: string; endsAt: string }[];
    /** Espacio elegido en la vista 3D; si falta, se asigna el primero libre. */
    preferredSpot?: { floor: number; number: number } | null;
  }): Promise<{ reservation: Reservation; qrToken: QRToken }> {
    if (params.selectedSlots.length === 0) {
      throw new Error('Selecciona al menos un bloque horario.');
    }

    const sorted = [...params.selectedSlots].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const startsAt = sorted[0].startsAt;
    const endsAt = sorted[sorted.length - 1].endsAt;
    const arrivalDeadlineAt = addMinutes(parseISO(startsAt), ARRIVAL_GRACE_MINUTES).toISOString();

    const lot = await parkingRepository.getById(params.parkingLotId);
    if (!lot) throw new Error('Parqueadero no encontrado.');

    const slotIds = sorted.map((s) => s.id);
    await takeSlots(slotIds);
    try {

      const { floor, spot } = await reservationRepository.assignSpot({
        parkingLotId: params.parkingLotId,
        vehicleType: params.vehicleType,
        totalCapacity: lot.totalCapacity,
        startsAt,
        endsAt,
        preferredFloor: params.preferredSpot?.floor,
        preferredSpotNumber: params.preferredSpot?.number,
      });

      const reservation = await reservationRepository.create({
        parkingLotId: params.parkingLotId,
        vehiclePlate: normalizePlate(params.vehiclePlate),
        vehicleType: params.vehicleType,
        startsAt,
        endsAt,
        arrivalDeadlineAt,
        assignedFloor: floor,
        assignedSpot: spot,
      });

      await reservationRepository.linkSlots(reservation.id, slotIds);

      const qrToken = await reservationRepository.createQRToken({
        reservationId: reservation.id,
        tokenHash: await generateQrToken(QRPurpose.ENTRY),
        purpose: QRPurpose.ENTRY,
        expiresAt: arrivalDeadlineAt,
      });

      await reservationRepository.createPayment({
        reservationId: reservation.id,
        type: PaymentType.RESERVATION,
        amount: (lot.pricePerBlock ?? 0) * sorted.length,
        status: PaymentStatus.SUCCESS,
      });

      return { reservation, qrToken };
    } catch (error) {
      await releaseSlots(slotIds);
      throw error;
    }
  },

  async cancelReservation(reservationId: string): Promise<void> {
    const reservation = await reservationRepository.getById(reservationId);
    if (!reservation) throw new Error('Reserva no encontrada');
    if (reservation.status !== ReservationStatus.RESERVED) throw new Error('Solo se pueden cancelar reservas en estado RESERVED');

    const minutesUntilStart = differenceInMinutes(parseISO(reservation.startsAt), new Date());
    if (minutesUntilStart < CANCELLATION_CUTOFF_MINUTES) {
      throw new Error(`Solo se puede cancelar con ${CANCELLATION_CUTOFF_MINUTES} minutos de anticipación.`);
    }

    await reservationRepository.updateStatus(reservationId, ReservationStatus.CANCELLED);

    // Devolver los cupos al inventario; si no, la plaza queda vendida a nadie.
    await releaseSlots(await reservationRepository.getSlotIds(reservationId));

    const payment = await reservationRepository.getPaymentByReservation(reservationId);
    await reservationRepository.createPayment({
      reservationId,
      type: PaymentType.REFUND,
      amount: payment?.amount ?? 0,
      status: PaymentStatus.SUCCESS,
    });
  },

  async extendReservation(reservationId: string, extraSlots: { id: string; endsAt: string }[]): Promise<void> {
    const reservation = await reservationRepository.getById(reservationId);
    if (!reservation) throw new Error('Reserva no encontrada');
    if (reservation.status !== ReservationStatus.CHECKED_IN) throw new Error('Solo se puede extender una reserva activa');

    await takeSlots(extraSlots.map((s) => s.id));

    const newEndsAt = extraSlots[extraSlots.length - 1].endsAt;
    await reservationRepository.updateStatus(reservationId, ReservationStatus.CHECKED_IN, { endsAt: newEndsAt });

    const lot = await parkingRepository.getById(reservation.parkingLotId);
    await reservationRepository.createPayment({
      reservationId,
      type: PaymentType.EXTENSION,
      amount: (lot?.pricePerBlock ?? 0) * extraSlots.length,
      status: PaymentStatus.SUCCESS,
    });
  },

  /**
   * Reservas de quien tiene la sesión (RLS sólo devuelve las propias).
   * De paso marca como vencidas las que pasaron su plazo de llegada; se piden
   * una sola vez y las actualizaciones van en paralelo.
   */
  async getMine(): Promise<Reservation[]> {
    const reservations = await reservationRepository.getMine();
    const now = new Date();
    const stale = reservations.filter(
      (r) => r.status === ReservationStatus.RESERVED && parseISO(r.arrivalDeadlineAt) < now,
    );
    await Promise.all(stale.map((r) => reservationRepository.updateStatus(r.id, ReservationStatus.EXPIRED)));
    const expiredIds = new Set(stale.map((r) => r.id));
    return reservations.map((r) =>
      expiredIds.has(r.id) ? { ...r, status: ReservationStatus.EXPIRED } : r,
    );
  },
};

export const checkEventService = {
  async validateEntry(qrHash: string): Promise<{ success: boolean; reason?: string; reservation?: Reservation }> {
    const qr = await reservationRepository.getQRTokenByHash(qrHash);
    if (!qr) return { success: false, reason: 'QR no válido' };
    if (qr.usedAt) return { success: false, reason: 'QR ya utilizado' };
    if (qr.purpose !== QRPurpose.ENTRY) return { success: false, reason: 'QR no es de entrada' };
    if (new Date() > parseISO(qr.expiresAt)) return { success: false, reason: 'QR expirado' };

    const reservation = await reservationRepository.getById(qr.reservationId);
    if (!reservation) return { success: false, reason: 'Reserva no encontrada' };
    if (reservation.status !== ReservationStatus.RESERVED) {
      return { success: false, reason: 'La reserva no está en estado RESERVED' };
    }

    const now = new Date().toISOString();
    await reservationRepository.markQRUsed(qr.id, now);
    await reservationRepository.updateStatus(reservation.id, ReservationStatus.CHECKED_IN, { checkedInAt: now });

    // Generar QR de salida
    await reservationRepository.createQRToken({
      reservationId: reservation.id,
      tokenHash: await generateQrToken(QRPurpose.EXIT),
      purpose: QRPurpose.EXIT,
      expiresAt: addMinutes(parseISO(reservation.endsAt), 70).toISOString(),
    });

    // Registrar evento FUERA de transacción
    reservationRepository.logCheckEvent({
      reservationId: reservation.id,
      type: QRPurpose.ENTRY,
      result: 'SUCCESS',
    }).catch(() => {});

    return { success: true, reservation };
  },

  async validateExit(qrHash: string): Promise<{ success: boolean; reason?: string; reservation?: Reservation }> {
    const qr = await reservationRepository.getQRTokenByHash(qrHash);
    if (!qr) return { success: false, reason: 'QR no válido' };
    if (qr.usedAt) return { success: false, reason: 'QR ya utilizado' };
    if (qr.purpose !== QRPurpose.EXIT) return { success: false, reason: 'QR no es de salida' };

    const reservation = await reservationRepository.getById(qr.reservationId);
    if (!reservation) return { success: false, reason: 'Reserva no encontrada' };
    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      return { success: false, reason: 'La reserva no está en estado CHECKED_IN' };
    }

    const now = new Date();
    const checkedIn = parseISO(reservation.checkedInAt ?? reservation.startsAt);
    const endsAt = parseISO(reservation.endsAt);
    const actualMinutes  = differenceInMinutes(now, checkedIn);
    const allowedMinutes = differenceInMinutes(endsAt, parseISO(reservation.startsAt)) + OVERSTAY_GRACE_MINUTES;
    const isOverstay = actualMinutes > allowedMinutes;

    const nowIso = now.toISOString();
    await reservationRepository.markQRUsed(qr.id, nowIso);
    await reservationRepository.updateStatus(
      reservation.id,
      isOverstay ? ReservationStatus.OVERSTAY : ReservationStatus.COMPLETED,
      { checkedOutAt: nowIso }
    );

    if (isOverstay) {
      const extraBlocks = Math.ceil((actualMinutes - allowedMinutes) / 30);
      const lot = await parkingRepository.getById(reservation.parkingLotId);
      await reservationRepository.createPayment({
        reservationId: reservation.id,
        type: PaymentType.PENALTY,
        amount: (lot?.pricePerBlock ?? 5000) * extraBlocks,
        status: PaymentStatus.SUCCESS,
      });
    }

    reservationRepository.logCheckEvent({
      reservationId: reservation.id,
      type: QRPurpose.EXIT,
      result: 'SUCCESS',
    }).catch(() => {});

    const updated = await reservationRepository.getById(reservation.id);
    return { success: true, reservation: updated ?? reservation };
  },
};

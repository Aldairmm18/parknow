import { supabase } from '@/lib/supabase';
import { Reservation, QRToken, Payment } from '@/domain/models';
import { ReservationStatus, QRPurpose, PaymentType, PaymentStatus, VehicleType } from '@/domain/enums';
import { SPOTS_PER_FLOOR } from '@/domain/floorPlan';

export const reservationRepository = {
  /**
   * Reserva un espacio físico concreto, o el primero libre si no se pide ninguno.
   *
   * `assigned_spot` es un correlativo **global** dentro del parqueadero
   * (1..capacidad total) y `assigned_floor` la planta que le corresponde. El
   * generador de planos usa exactamente la misma numeración, así que el espacio
   * que el usuario tocó en el 3D es el que queda guardado.
   */
  async assignSpot(params: {
    parkingLotId: string;
    vehicleType: VehicleType;
    totalCapacity: number;
    startsAt: string;
    endsAt: string;
    /** Espacio elegido a mano en la vista 3D. */
    preferredSpotNumber?: number;
    preferredFloor?: number;
  }): Promise<{ floor: number; spot: number }> {
    const { data, error } = await supabase
      .from('reservations')
      .select('assigned_floor, assigned_spot')
      .eq('parking_lot_id', params.parkingLotId)
      .in('status', [ReservationStatus.RESERVED, ReservationStatus.CHECKED_IN])
      .lt('starts_at', params.endsAt)
      .gt('ends_at', params.startsAt);
    if (error) throw new Error(error.message);

    const taken = new Set(
      (data ?? [])
        .filter((r: any) => r.assigned_spot != null)
        .map((r: any) => `${r.assigned_floor}:${r.assigned_spot}`),
    );

    if (params.preferredSpotNumber != null && params.preferredFloor != null) {
      const key = `${params.preferredFloor}:${params.preferredSpotNumber}`;
      if (taken.has(key)) {
        throw new Error('Ese espacio acaba de ser tomado. Elige otro en el plano.');
      }
      return { floor: params.preferredFloor, spot: params.preferredSpotNumber };
    }

    // Sin preferencia: el primer correlativo libre.
    for (let number = 1; number <= Math.max(1, params.totalCapacity); number++) {
      const floor = Math.max(1, Math.ceil(number / SPOTS_PER_FLOOR));
      if (!taken.has(`${floor}:${number}`)) return { floor, spot: number };
    }
    throw new Error('No quedan espacios libres en ese horario.');
  },

  /** `owner_id` lo pone la base de datos (`default auth.uid()`), no la app. */
  async create(params: {
    parkingLotId: string;
    vehiclePlate: string;
    vehicleType: VehicleType;
    startsAt: string;
    endsAt: string;
    arrivalDeadlineAt: string;
    assignedFloor: number;
    assignedSpot: number;
  }): Promise<Reservation> {
    const { data, error } = await supabase
      .from('reservations')
      .insert({
        parking_lot_id: params.parkingLotId,
        vehicle_plate: params.vehiclePlate,
        vehicle_type: params.vehicleType,
        starts_at: params.startsAt,
        ends_at: params.endsAt,
        status: ReservationStatus.RESERVED,
        arrival_deadline_at: params.arrivalDeadlineAt,
        assigned_floor: params.assignedFloor,
        assigned_spot: params.assignedSpot,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapReservation(data);
  },

  /**
   * Guarda qué bloques horarios compró la reserva.
   *
   * Sin esto la cancelación no sabe qué cupos devolver: hoy se deduce del rango
   * `starts_at`–`ends_at`, lo que falla en cuanto una reserva se extiende.
   */
  async linkSlots(reservationId: string, slotIds: string[]): Promise<void> {
    if (slotIds.length === 0) return;
    const { error } = await supabase
      .from('reservation_slots')
      .insert(slotIds.map((slotId) => ({ reservation_id: reservationId, slot_id: slotId })));
    // No es crítico: la reserva ya existe y el cobro también.
    if (error && !error.message.includes('duplicate')) {
      console.warn('No se pudieron vincular los bloques de la reserva:', error.message);
    }
  },

  async getSlotIds(reservationId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('reservation_slots')
      .select('slot_id')
      .eq('reservation_id', reservationId);
    if (error) return [];
    return (data ?? []).map((r: any) => r.slot_id);
  },

  /** Las reservas de la sesión actual: la política RLS filtra por `auth.uid()`. */
  async getMine(): Promise<Reservation[]> {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapReservation);
  },

  async getById(id: string): Promise<Reservation | null> {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw new Error(error.message);
    return data ? mapReservation(data) : null;
  },

  async updateStatus(id: string, status: ReservationStatus, extra?: {
    checkedInAt?: string;
    checkedOutAt?: string;
    endsAt?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('reservations')
      .update({ status, ...extra && {
        checked_in_at: extra.checkedInAt,
        checked_out_at: extra.checkedOutAt,
        ends_at: extra.endsAt,
      }})
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async createQRToken(params: {
    reservationId: string;
    tokenHash: string;
    purpose: QRPurpose;
    expiresAt: string;
  }): Promise<QRToken> {
    const { data, error } = await supabase
      .from('qr_tokens')
      .insert({
        reservation_id: params.reservationId,
        token_hash: params.tokenHash,
        purpose: params.purpose,
        expires_at: params.expiresAt,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapQRToken(data);
  },

  async getQRTokenByHash(hash: string): Promise<QRToken | null> {
    const { data, error } = await supabase
      .from('qr_tokens')
      .select('*')
      .eq('token_hash', hash)
      .single();
    if (error) return null;
    return data ? mapQRToken(data) : null;
  },

  async getEntryQRForReservation(reservationId: string): Promise<QRToken | null> {
    const { data, error } = await supabase
      .from('qr_tokens')
      .select('*')
      .eq('reservation_id', reservationId)
      .eq('purpose', QRPurpose.ENTRY)
      .single();
    if (error) return null;
    return data ? mapQRToken(data) : null;
  },

  async markQRUsed(id: string, usedAt: string): Promise<void> {
    const { error } = await supabase
      .from('qr_tokens')
      .update({ used_at: usedAt })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async createPayment(params: {
    reservationId: string;
    type: PaymentType;
    amount: number;
    status: PaymentStatus;
  }): Promise<Payment> {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        reservation_id: params.reservationId,
        type: params.type,
        amount: params.amount,
        status: params.status,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapPayment(data);
  },

  async getPaymentByReservation(reservationId: string): Promise<Payment | null> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('reservation_id', reservationId)
      .eq('type', PaymentType.RESERVATION)
      .single();
    if (error) return null;
    return data ? mapPayment(data) : null;
  },

  async logCheckEvent(params: {
    reservationId: string;
    type: QRPurpose;
    result: string;
    reason?: string;
  }): Promise<void> {
    await supabase.from('check_events').insert({
      reservation_id: params.reservationId,
      type: params.type,
      result: params.result,
      reason: params.reason,
    });
  },
};

function mapReservation(row: any): Reservation {
  return {
    id:               row.id,
    parkingLotId:     row.parking_lot_id,
    vehiclePlate:     row.vehicle_plate,
    startsAt:         row.starts_at,
    endsAt:           row.ends_at,
    status:           row.status as ReservationStatus,
    arrivalDeadlineAt: row.arrival_deadline_at,
    checkedInAt:      row.checked_in_at,
    checkedOutAt:     row.checked_out_at,
    createdAt:        row.created_at,
    assignedFloor:    row.assigned_floor ?? undefined,
    assignedSpot:     row.assigned_spot ?? undefined,
    vehicleType:      row.vehicle_type as VehicleType ?? undefined,
  };
}

function mapQRToken(row: any): QRToken {
  return {
    id:            row.id,
    reservationId: row.reservation_id,
    tokenHash:     row.token_hash,
    purpose:       row.purpose as QRPurpose,
    expiresAt:     row.expires_at,
    usedAt:        row.used_at,
  };
}

function mapPayment(row: any): Payment {
  return {
    id:            row.id,
    reservationId: row.reservation_id,
    type:          row.type as PaymentType,
    amount:        Number(row.amount),
    status:        row.status as PaymentStatus,
    createdAt:     row.created_at,
  };
}

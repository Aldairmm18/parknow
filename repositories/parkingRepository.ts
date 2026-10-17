import { supabase } from '@/lib/supabase';
import { ParkingLot, TimeSlot } from '@/domain/models';

export const parkingRepository = {
  async getAll(): Promise<ParkingLot[]> {
    const { data, error } = await supabase
      .from('parking_lots')
      .select('*')
      .order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapLot);
  },

  async getById(id: string): Promise<ParkingLot | null> {
    const { data, error } = await supabase
      .from('parking_lots')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapLot(data) : null;
  },

  async getTimeSlots(parkingLotId: string, date: string): Promise<TimeSlot[]> {
    // Los límites se construyen en la zona del dispositivo y se envían en ISO
    // con desfase, para que "hoy" signifique lo mismo en el cliente y en la BD.
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59.999`);

    const { data, error } = await supabase
      .from('time_slots')
      .select('*')
      .eq('parking_lot_id', parkingLotId)
      .gte('starts_at', dayStart.toISOString())
      .lte('starts_at', dayEnd.toISOString())
      .order('starts_at');
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapSlot);
  },

  async getSlotsByIds(ids: string[]): Promise<TimeSlot[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from('time_slots')
      .select('*')
      .in('id', ids)
      .order('starts_at');
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapSlot);
  },

  /**
   * Resta un cupo al bloque.
   *
   * Va por RPC y no por leer-y-escribir desde el cliente: dos personas
   * reservando el último cupo a la vez leerían ambas `1` y ambas escribirían
   * `0`, vendiendo el mismo espacio dos veces. La función hace el `update`
   * condicional en una sola sentencia y falla si ya no queda capacidad.
   */
  async decrementCapacity(slotId: string): Promise<void> {
    const { error } = await supabase.rpc('decrement_slot_capacity', { slot_id: slotId });
    if (error) throw new Error('Se agotaron los cupos de uno de los bloques seleccionados.');
  },

  async incrementCapacity(slotId: string): Promise<void> {
    const { error } = await supabase.rpc('increment_slot_capacity', { slot_id: slotId });
    if (error) throw new Error(error.message);
  },

  /**
   * Cupos libres ahora mismo: capacidad del primer bloque que todavía no ha
   * terminado. Es la cifra que la gente espera ver en "¿puedo entrar ya?".
   */
  async getAvailableNow(parkingLotId: string): Promise<number> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('time_slots')
      .select('available_capacity')
      .eq('parking_lot_id', parkingLotId)
      .gte('ends_at', now)
      .order('starts_at')
      .limit(1);
    if (error) return 0;
    return data?.[0]?.available_capacity ?? 0;
  },

  /**
   * Cupos libres del bloque vigente para **varios** parqueaderos en una sola
   * consulta. La pantalla de inicio llamaba antes una vez por parqueadero:
   * con 20 parqueaderos eran 20 idas y vueltas antes de pintar nada.
   */
  async getAvailabilityMap(parkingLotIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (parkingLotIds.length === 0) return result;

    const now = new Date().toISOString();
    const horizon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('time_slots')
      .select('parking_lot_id, available_capacity, starts_at')
      .in('parking_lot_id', parkingLotIds)
      .gte('ends_at', now)
      .lte('starts_at', horizon)
      .order('starts_at');
    if (error) return result;

    // Se queda con el primer bloque de cada parqueadero (el más próximo).
    for (const row of data ?? []) {
      if (!result.has(row.parking_lot_id)) {
        result.set(row.parking_lot_id, row.available_capacity ?? 0);
      }
    }
    return result;
  },

  /**
   * Espacios físicos ya tomados en un rango horario, para pintar el plano 3D.
   *
   * Se solapa si `starts_at < fin` y `ends_at > inicio`; las reservas
   * canceladas o expiradas no bloquean nada.
   */
  async getOccupiedSpots(
    parkingLotId: string,
    startsAt: string,
    endsAt: string,
  ): Promise<{ floor: number; spot: number }[]> {
    const { data, error } = await supabase
      .from('reservations')
      .select('assigned_floor, assigned_spot')
      .eq('parking_lot_id', parkingLotId)
      .in('status', ['RESERVED', 'CHECKED_IN'])
      .lt('starts_at', endsAt)
      .gt('ends_at', startsAt);
    if (error) throw new Error(error.message);

    return (data ?? [])
      .filter((r: any) => r.assigned_floor != null && r.assigned_spot != null)
      .map((r: any) => ({ floor: r.assigned_floor, spot: r.assigned_spot }));
  },
};

function mapLot(row: any): ParkingLot {
  const total = row.total_capacity ?? 0;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    totalCapacity: total,
    carCapacity: row.car_capacity ?? Math.floor(total * 0.7),
    motoCapacity: row.moto_capacity ?? Math.floor(total * 0.3),
    pricePerBlock: Number(row.price_per_block),
    address: row.address ?? '',
    latitude: row.latitude != null ? Number(row.latitude) : undefined,
    longitude: row.longitude != null ? Number(row.longitude) : undefined,
    floors: row.floors ?? undefined,
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    opensAt: row.opens_at ?? undefined,
    closesAt: row.closes_at ?? undefined,
    rating: row.rating != null ? Number(row.rating) : undefined,
  };
}

function mapSlot(row: any): TimeSlot {
  return {
    id: row.id,
    parkingLotId: row.parking_lot_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    availableCapacity: row.available_capacity,
    pricePerBlock: row.price_per_block != null ? Number(row.price_per_block) : undefined,
  };
}

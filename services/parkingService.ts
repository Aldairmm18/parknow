import { parkingRepository } from '@/repositories/parkingRepository';
import { ParkingLot, ParkingLotWithAvailability, TimeSlot } from '@/domain/models';
import { SpotStatus, VehicleType } from '@/domain/enums';
import { buildFloorPlans, FloorPlan, SPOTS_PER_FLOOR, Spot, spotAcceptsVehicle } from '@/domain/floorPlan';
import { distanceMeters, LatLng } from '@/lib/geo';

export const parkingService = {
  /**
   * Parqueaderos con disponibilidad y, si se pasa la posición del usuario,
   * ordenados por cercanía.
   *
   * La disponibilidad se resuelve en una sola consulta agrupada en lugar de
   * una por parqueadero (ver `getAvailabilityMap`).
   */
  async getAllWithAvailability(userLocation?: LatLng | null): Promise<ParkingLotWithAvailability[]> {
    const lots = await parkingRepository.getAll();
    const availability = await parkingRepository.getAvailabilityMap(lots.map((l) => l.id));

    const enriched = lots.map((lot) => {
      const availableSlots = availability.get(lot.id) ?? 0;
      return {
        ...lot,
        availableSlots,
        occupancyPercent: occupancyPercent(lot.totalCapacity, availableSlots),
        distanceMeters:
          userLocation && lot.latitude != null && lot.longitude != null
            ? distanceMeters(userLocation, { latitude: lot.latitude, longitude: lot.longitude })
            : undefined,
      };
    });

    if (!userLocation) return enriched;

    // Los que no tienen coordenadas van al final, no al principio.
    return enriched.sort((a, b) =>
      (a.distanceMeters ?? Number.POSITIVE_INFINITY) - (b.distanceMeters ?? Number.POSITIVE_INFINITY));
  },

  async getById(id: string): Promise<ParkingLot | null> {
    return parkingRepository.getById(id);
  },

  async getByIdWithAvailability(
    id: string,
    userLocation?: LatLng | null,
  ): Promise<ParkingLotWithAvailability | null> {
    const lot = await parkingRepository.getById(id);
    if (!lot) return null;

    const availableSlots = await parkingRepository.getAvailableNow(id);
    return {
      ...lot,
      availableSlots,
      occupancyPercent: occupancyPercent(lot.totalCapacity, availableSlots),
      distanceMeters:
        userLocation && lot.latitude != null && lot.longitude != null
          ? distanceMeters(userLocation, { latitude: lot.latitude, longitude: lot.longitude })
          : undefined,
    };
  },

  async getTimeSlots(parkingLotId: string, date: string): Promise<TimeSlot[]> {
    return parkingRepository.getTimeSlots(parkingLotId, date);
  },

  /**
   * Planos de las plantas con el estado real de cada espacio en el rango
   * horario pedido.
   *
   * La geometría se genera en el dispositivo (determinista por parqueadero) y
   * sólo la **ocupación** viaja por la red: unas pocas filas en lugar del plano
   * completo, y el 3D se puede pintar aunque la consulta tarde.
   */
  async getFloorPlans(params: {
    parkingLotId: string;
    startsAt: string;
    endsAt: string;
    /** Filtra los espacios que no admiten este vehículo. */
    vehicleType?: VehicleType;
    /** Espacio de la reserva propia, para resaltarlo como "el tuyo". */
    ownSpot?: { floor: number; spot: number } | null;
  }): Promise<FloorPlan[]> {
    const lot = await parkingRepository.getById(params.parkingLotId);
    if (!lot) throw new Error('Parqueadero no encontrado');

    const plans = buildFloorPlans(lot.totalCapacity, lot.id);

    let occupied: { floor: number; spot: number }[] = [];
    try {
      occupied = await parkingRepository.getOccupiedSpots(
        params.parkingLotId, params.startsAt, params.endsAt,
      );
    } catch {
      // Sin datos de ocupación el plano se muestra igual, todo como libre.
    }

    const takenKeys = new Set(occupied.map((o) => `${o.floor}:${o.spot}`));
    const ownKey = params.ownSpot ? `${params.ownSpot.floor}:${params.ownSpot.spot}` : null;

    return plans.map((plan) => ({
      ...plan,
      spots: plan.spots.map((spot, index) => {
        // `assigned_spot` es un correlativo global dentro del parqueadero;
        // debe coincidir con el que reparte `reservationRepository.assignSpot`.
        const globalNumber = (plan.floor - 1) * SPOTS_PER_FLOOR + index + 1;
        const key = `${plan.floor}:${globalNumber}`;

        if (ownKey === key) return { ...spot, status: SpotStatus.MINE, number: globalNumber };
        if (spot.status === SpotStatus.BLOCKED) return { ...spot, number: globalNumber };
        if (takenKeys.has(key)) return { ...spot, status: SpotStatus.TAKEN, number: globalNumber };

        // Un espacio que no admite el vehículo se muestra, pero no se puede elegir.
        if (params.vehicleType && !spotAcceptsVehicle(spot.kind, params.vehicleType)) {
          return { ...spot, status: SpotStatus.BLOCKED, number: globalNumber };
        }
        return { ...spot, status: SpotStatus.FREE, number: globalNumber };
      }),
    }));
  },

  /** Primer espacio libre que admite el vehículo; para la asignación automática. */
  findFirstFree(plans: FloorPlan[], vehicleType: VehicleType): Spot | null {
    for (const plan of plans) {
      const match = plan.spots.find(
        (s) => s.status === SpotStatus.FREE && spotAcceptsVehicle(s.kind, vehicleType),
      );
      if (match) return match;
    }
    return null;
  },
};

function occupancyPercent(totalCapacity: number, available: number): number {
  if (totalCapacity <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((totalCapacity - available) / totalCapacity) * 100)));
}

import { Booking, Vehicle } from '@prisma/client';
import { EngineBooking, EngineVehicle } from './engine/types';

export function toEngineBooking(b: Booking & { renter?: { name: string } | null }): EngineBooking {
  return {
    id: b.id,
    vehicleId: b.vehicleId,
    source: b.source as EngineBooking['source'],
    status: b.status as EngineBooking['status'],
    startAt: b.startAt,
    endAt: b.endAt,
    dailyRateCents: b.dailyRateCents,
    coverageDailyCents: b.coverageDailyCents,
    renterName: b.renter?.name ?? null,
  };
}

export function toEngineVehicle(v: Vehicle): EngineVehicle {
  return {
    id: v.id,
    name: v.name,
    category: v.category,
    seats: v.seats,
    dailyRateCents: v.dailyRateCents,
  };
}

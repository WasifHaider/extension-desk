import { DateTime } from 'luxon';
import { quoteExtension } from './quoteExtension';
import {
  EngineBooking,
  EngineSettings,
  EngineVehicle,
  Evaluation,
  EngineOption,
  UnavailableOption,
} from './types';

const MS_PER_MINUTE = 60 * 1000;

function isBlocking(b: EngineBooking): boolean {
  return b.status === 'CONFIRMED' || b.status === 'ACTIVE';
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function roundDownTo30(ms: number): Date {
  const date = new Date(ms);
  const minutes = date.getUTCMinutes();
  const flooredMinutes = minutes - (minutes % 30);
  date.setUTCMinutes(flooredMinutes, 0, 0);
  return date;
}

function formatWhen(date: Date, timezone?: string): string {
  return DateTime.fromJSDate(date, { zone: 'utc' })
    .setZone(timezone ?? 'utc')
    .toFormat('ccc h:mm a');
}

function vehicleFreeForWindow(
  vehicleId: string,
  windowStart: number,
  windowEnd: number,
  bufferMs: number,
  bookings: EngineBooking[],
  excludeBookingId?: string,
): boolean {
  return !bookings.some(
    (b) =>
      b.vehicleId === vehicleId &&
      b.id !== excludeBookingId &&
      isBlocking(b) &&
      overlaps(
        windowStart - bufferMs,
        windowEnd + bufferMs,
        b.startAt.getTime(),
        b.endAt.getTime(),
      ),
  );
}

interface EvaluateExtensionArgs {
  booking: EngineBooking;
  requestedEndAt: Date;
  bookings: EngineBooking[];
  vehicles: EngineVehicle[];
  settings: EngineSettings;
}

export function evaluateExtension({
  booking,
  requestedEndAt,
  bookings,
  vehicles,
  settings,
}: EvaluateExtensionArgs): Evaluation {
  const bufferMs = settings.turnaroundBufferMinutes * MS_PER_MINUTE;
  const requestedEndMs = requestedEndAt.getTime();
  const currentEndMs = booking.endAt.getTime();

  const blockingOnVehicle = bookings.filter(
    (b) => b.vehicleId === booking.vehicleId && b.id !== booking.id && isBlocking(b),
  );

  const conflicts = blockingOnVehicle.filter((b) =>
    overlaps(currentEndMs, requestedEndMs + bufferMs, b.startAt.getTime(), b.endAt.getTime()),
  );

  const latestFreeEnd =
    conflicts.length > 0
      ? new Date(Math.min(...conflicts.map((c) => c.startAt.getTime())) - bufferMs)
      : requestedEndAt;

  const nextBooking =
    blockingOnVehicle
      .filter((b) => b.startAt.getTime() >= currentEndMs)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0] ?? null;

  const freeUntil = nextBooking ? new Date(nextBooking.startAt.getTime() - bufferMs) : null;

  const options: EngineOption[] = [];
  const unavailable: UnavailableOption[] = [];

  if (conflicts.length === 0) {
    options.push({
      type: 'FULL',
      newEndAt: requestedEndAt,
      quote: quoteExtension(booking, requestedEndAt, settings),
    });
  } else {
    const blockerWord = conflicts.length > 1 ? 'bookings' : 'booking';
    unavailable.push({
      type: 'FULL',
      reason:
        conflicts.length > 1
          ? 'More than one booking is in the way'
          : `Another ${blockerWord} starts ${formatWhen(conflicts[0].startAt, settings.timezone)}`,
    });

    if (latestFreeEnd.getTime() >= currentEndMs + 60 * MS_PER_MINUTE) {
      const partialEnd = roundDownTo30(latestFreeEnd.getTime());
      options.push({
        type: 'PARTIAL',
        newEndAt: partialEnd,
        quote: quoteExtension(booking, partialEnd, settings),
      });
    } else {
      unavailable.push({
        type: 'PARTIAL',
        reason: 'Not enough free time for a partial extension',
      });
    }

    if (conflicts.length > 1) {
      unavailable.push({ type: 'REASSIGN_NEXT', reason: 'More than one booking in the way' });
    } else {
      const conflict = conflicts[0];
      if (conflict.source === 'TURO') {
        unavailable.push({
          type: 'REASSIGN_NEXT',
          reason: "Next booking is on Turo — it can't be moved from here",
        });
      } else if (!(conflict.source === 'DIRECT' && conflict.status === 'CONFIRMED')) {
        unavailable.push({
          type: 'REASSIGN_NEXT',
          reason: "Can't move an active trip",
        });
      } else {
        const originalVehicle = vehicles.find((v) => v.id === booking.vehicleId);
        const comparable = vehicles
          .filter(
            (v) =>
              v.id !== booking.vehicleId &&
              originalVehicle &&
              v.category === originalVehicle.category &&
              v.seats >= originalVehicle.seats,
          )
          .filter((v) =>
            vehicleFreeForWindow(
              v.id,
              conflict.startAt.getTime(),
              conflict.endAt.getTime(),
              bufferMs,
              bookings,
            ),
          )
          .sort((a, b) => {
            const diffA = Math.abs(a.dailyRateCents - (originalVehicle?.dailyRateCents ?? 0));
            const diffB = Math.abs(b.dailyRateCents - (originalVehicle?.dailyRateCents ?? 0));
            if (diffA !== diffB) {
              return diffA - diffB;
            }
            if (a.dailyRateCents !== b.dailyRateCents) {
              return a.dailyRateCents - b.dailyRateCents;
            }
            return a.name.localeCompare(b.name);
          })[0];

        if (comparable) {
          options.push({
            type: 'REASSIGN_NEXT',
            newEndAt: requestedEndAt,
            quote: quoteExtension(booking, requestedEndAt, settings),
            reassign: {
              bookingId: conflict.id,
              fromVehicleId: booking.vehicleId,
              toVehicleId: comparable.id,
            },
          });
        } else {
          unavailable.push({
            type: 'REASSIGN_NEXT',
            reason: `No comparable ${originalVehicle?.category ?? 'vehicle'} free ${formatWhen(
              conflict.startAt,
              settings.timezone,
            )} – ${formatWhen(conflict.endAt, settings.timezone)}`,
          });
        }
      }
    }
  }

  options.push({ type: 'DECLINE', newEndAt: booking.endAt, quote: null });

  return { options, unavailable, conflicts, latestFreeEnd, nextBooking, freeUntil };
}

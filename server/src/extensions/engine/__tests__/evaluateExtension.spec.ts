import { evaluateExtension } from '../evaluateExtension';
import { EngineBooking, EngineSettings, EngineVehicle } from '../types';

const settings: EngineSettings = {
  turnaroundBufferMinutes: 120,
  longTripTiers: [
    { minDays: 7, pct: 10 },
    { minDays: 28, pct: 20 },
  ],
  timezone: 'UTC',
};

const vehicles: EngineVehicle[] = [
  { id: 'wrangler', name: 'Jeep Wrangler', category: 'SUV', seats: 5, dailyRateCents: 11000 },
  { id: 'rav4', name: 'Toyota RAV4', category: 'Compact SUV', seats: 5, dailyRateCents: 7500 },
  { id: 'crv', name: 'Honda CR-V', category: 'Compact SUV', seats: 5, dailyRateCents: 7200 },
  { id: 'rogue', name: 'Nissan Rogue', category: 'Compact SUV', seats: 5, dailyRateCents: 7000 },
];

function makeBooking(overrides: Partial<EngineBooking> = {}): EngineBooking {
  return {
    id: 'current',
    vehicleId: 'rav4',
    source: 'DIRECT',
    status: 'ACTIVE',
    startAt: new Date('2026-10-01T10:00:00Z'),
    endAt: new Date('2026-10-02T10:00:00Z'),
    dailyRateCents: 7500,
    coverageDailyCents: 0,
    ...overrides,
  };
}

describe('evaluateExtension', () => {
  it('offers FULL when nothing follows', () => {
    const booking = makeBooking();
    const requestedEndAt = new Date('2026-10-04T10:00:00Z');
    const result = evaluateExtension({ booking, requestedEndAt, bookings: [booking], vehicles, settings });

    expect(result.options.some((o) => o.type === 'FULL')).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it('offers FULL exactly at the buffer boundary', () => {
    const booking = makeBooking();
    const next: EngineBooking = {
      ...makeBooking({ id: 'next', source: 'TURO' }),
      startAt: new Date('2026-10-04T12:00:00Z'),
      endAt: new Date('2026-10-06T12:00:00Z'),
    };
    const requestedEndAt = new Date(next.startAt.getTime() - 120 * 60 * 1000);
    const result = evaluateExtension({
      booking,
      requestedEndAt,
      bookings: [booking, next],
      vehicles,
      settings,
    });

    expect(result.conflicts).toHaveLength(0);
    expect(result.options.some((o) => o.type === 'FULL')).toBe(true);
  });

  it('offers PARTIAL with a Turo reason and no REASSIGN when the next booking is Turo', () => {
    const booking = makeBooking({ vehicleId: 'wrangler', dailyRateCents: 11000, coverageDailyCents: 1500 });
    const turo: EngineBooking = {
      id: 'turo-next',
      vehicleId: 'wrangler',
      source: 'TURO',
      status: 'CONFIRMED',
      startAt: new Date('2026-10-03T10:00:00Z'),
      endAt: new Date('2026-10-05T10:00:00Z'),
      dailyRateCents: 11000,
      coverageDailyCents: 0,
    };
    const requestedEndAt = new Date('2026-10-04T21:00:00Z');
    const result = evaluateExtension({
      booking,
      requestedEndAt,
      bookings: [booking, turo],
      vehicles,
      settings,
    });

    expect(result.conflicts).toHaveLength(1);
    expect(result.options.some((o) => o.type === 'PARTIAL')).toBe(true);
    expect(result.options.some((o) => o.type === 'REASSIGN_NEXT')).toBe(false);
    const reassignUnavailable = result.unavailable.find((u) => u.type === 'REASSIGN_NEXT');
    expect(reassignUnavailable?.reason).toBe("Next booking is on Turo — it can't be moved from here");
  });

  it('offers REASSIGN_NEXT when the next booking is direct and a comparable car is free', () => {
    const booking = makeBooking();
    const tom: EngineBooking = {
      id: 'tom',
      vehicleId: 'rav4',
      source: 'DIRECT',
      status: 'CONFIRMED',
      startAt: new Date('2026-10-03T10:00:00Z'),
      endAt: new Date('2026-10-05T10:00:00Z'),
      dailyRateCents: 7500,
      coverageDailyCents: 0,
    };
    const requestedEndAt = new Date('2026-10-04T18:00:00Z');
    const result = evaluateExtension({
      booking,
      requestedEndAt,
      bookings: [booking, tom],
      vehicles,
      settings,
    });

    const reassign = result.options.find((o) => o.type === 'REASSIGN_NEXT');
    expect(reassign).toBeDefined();
    expect(reassign?.reassign?.toVehicleId).toBe('crv');
  });

  it('marks REASSIGN_NEXT unavailable when the comparable car is busy', () => {
    const booking = makeBooking();
    const tom: EngineBooking = {
      id: 'tom',
      vehicleId: 'rav4',
      source: 'DIRECT',
      status: 'CONFIRMED',
      startAt: new Date('2026-10-03T10:00:00Z'),
      endAt: new Date('2026-10-05T10:00:00Z'),
      dailyRateCents: 7500,
      coverageDailyCents: 0,
    };
    const crvBusy: EngineBooking = {
      id: 'crv-busy',
      vehicleId: 'crv',
      source: 'DIRECT',
      status: 'CONFIRMED',
      startAt: new Date('2026-10-03T10:00:00Z'),
      endAt: new Date('2026-10-05T10:00:00Z'),
      dailyRateCents: 7200,
      coverageDailyCents: 0,
    };
    const rogueBusy: EngineBooking = {
      id: 'rogue-busy',
      vehicleId: 'rogue',
      source: 'DIRECT',
      status: 'CONFIRMED',
      startAt: new Date('2026-10-03T10:00:00Z'),
      endAt: new Date('2026-10-05T10:00:00Z'),
      dailyRateCents: 7000,
      coverageDailyCents: 0,
    };
    const requestedEndAt = new Date('2026-10-04T18:00:00Z');
    const result = evaluateExtension({
      booking,
      requestedEndAt,
      bookings: [booking, tom, crvBusy, rogueBusy],
      vehicles,
      settings,
    });

    expect(result.options.some((o) => o.type === 'REASSIGN_NEXT')).toBe(false);
    const reassignUnavailable = result.unavailable.find((u) => u.type === 'REASSIGN_NEXT');
    expect(reassignUnavailable?.reason).toMatch(/^No comparable Compact SUV free/);
  });

  it('does not let CANCELLED bookings block', () => {
    const booking = makeBooking();
    const cancelled: EngineBooking = {
      id: 'cancelled',
      vehicleId: 'rav4',
      source: 'DIRECT',
      status: 'CANCELLED',
      startAt: new Date('2026-10-02T12:00:00Z'),
      endAt: new Date('2026-10-04T12:00:00Z'),
      dailyRateCents: 7500,
      coverageDailyCents: 0,
    };
    const requestedEndAt = new Date('2026-10-04T10:00:00Z');
    const result = evaluateExtension({
      booking,
      requestedEndAt,
      bookings: [booking, cancelled],
      vehicles,
      settings,
    });

    expect(result.conflicts).toHaveLength(0);
    expect(result.options.some((o) => o.type === 'FULL')).toBe(true);
  });

  it('does not offer REASSIGN when two bookings are in the way', () => {
    const booking = makeBooking();
    const first: EngineBooking = {
      id: 'first',
      vehicleId: 'rav4',
      source: 'DIRECT',
      status: 'CONFIRMED',
      startAt: new Date('2026-10-03T00:00:00Z'),
      endAt: new Date('2026-10-03T12:00:00Z'),
      dailyRateCents: 7500,
      coverageDailyCents: 0,
    };
    const second: EngineBooking = {
      id: 'second',
      vehicleId: 'rav4',
      source: 'DIRECT',
      status: 'CONFIRMED',
      startAt: new Date('2026-10-03T14:00:00Z'),
      endAt: new Date('2026-10-05T14:00:00Z'),
      dailyRateCents: 7500,
      coverageDailyCents: 0,
    };
    const requestedEndAt = new Date('2026-10-04T18:00:00Z');
    const result = evaluateExtension({
      booking,
      requestedEndAt,
      bookings: [booking, first, second],
      vehicles,
      settings,
    });

    expect(result.conflicts).toHaveLength(2);
    expect(result.options.some((o) => o.type === 'REASSIGN_NEXT')).toBe(false);
    const reassignUnavailable = result.unavailable.find((u) => u.type === 'REASSIGN_NEXT');
    expect(reassignUnavailable?.reason).toBe('More than one booking in the way');
  });
});

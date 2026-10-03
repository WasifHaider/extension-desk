import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PlaygroundService } from '../playground.service';
import { seedPlayground } from '../seed';
import { seed as seedDemo } from '../../dev/seed';
import { evaluateExtension } from '../../extensions/engine/evaluateExtension';
import { toEngineBooking, toEngineVehicle } from '../../extensions/prismaMappers';
import { settings } from '../../config/settings';

const prisma = new PrismaService();
const service = new PlaygroundService(prisma);

const engineSettings = {
  turnaroundBufferMinutes: settings.turnaroundBufferMinutes,
  longTripTiers: [...settings.longTripTiers],
  timezone: settings.timezone,
};

afterAll(async () => {
  await seedDemo(prisma);
  await seedPlayground(prisma);
  await prisma.$disconnect();
});

describe('playground isolation', () => {
  it('resetting the playground leaves the demo seed at 5 requests, and vice versa', async () => {
    await seedDemo(prisma);
    const demoCountBefore = await prisma.extensionRequest.count({
      where: { booking: { vehicle: { scope: 'DEMO' } } },
    });
    expect(demoCountBefore).toBe(5);

    await seedPlayground(prisma);
    const demoCountAfterPlaygroundReset = await prisma.extensionRequest.count({
      where: { booking: { vehicle: { scope: 'DEMO' } } },
    });
    expect(demoCountAfterPlaygroundReset).toBe(5);

    const playgroundVehicleCount = await prisma.vehicle.count({ where: { scope: 'PLAYGROUND' } });
    expect(playgroundVehicleCount).toBe(8);

    await seedDemo(prisma);
    const playgroundVehicleCountAfterDemoReset = await prisma.vehicle.count({
      where: { scope: 'PLAYGROUND' },
    });
    expect(playgroundVehicleCountAfterDemoReset).toBe(8);
    const demoCountAfterSecondDemoReset = await prisma.extensionRequest.count({
      where: { booking: { vehicle: { scope: 'DEMO' } } },
    });
    expect(demoCountAfterSecondDemoReset).toBe(5);
  });
});

describe('playground booking builder', () => {
  beforeEach(async () => {
    await seedPlayground(prisma);
  });

  it('rejects a booking that overlaps another blocking booking on the same vehicle', async () => {
    const wasifBooking = await prisma.booking.findFirstOrThrow({
      where: { vehicle: { scope: 'PLAYGROUND' }, status: 'ACTIVE' },
    });

    await expect(
      service.createBooking({
        vehicleId: wasifBooking.vehicleId,
        renterName: null,
        source: 'TURO',
        startAt: new Date(wasifBooking.startAt.getTime() + 60 * 60 * 1000).toISOString(),
        endAt: new Date(wasifBooking.endAt.getTime() + 60 * 60 * 1000).toISOString(),
        hasCover: false,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('a Turo booking built right after the active trip produces a PARTIAL option and the Turo reason on REASSIGN', async () => {
    const wasifBooking = await prisma.booking.findFirstOrThrow({
      where: { vehicle: { scope: 'PLAYGROUND' }, status: 'ACTIVE' },
    });

    const turoStart = new Date(wasifBooking.endAt.getTime() + 24 * 60 * 60 * 1000);
    const turoEnd = new Date(wasifBooking.endAt.getTime() + 4 * 24 * 60 * 60 * 1000);
    await service.createBooking({
      vehicleId: wasifBooking.vehicleId,
      renterName: null,
      source: 'TURO',
      startAt: turoStart.toISOString(),
      endAt: turoEnd.toISOString(),
      hasCover: false,
    });

    const requestedEndAt = new Date(wasifBooking.endAt.getTime() + 2 * 24 * 60 * 60 * 1000);
    const [allBookings, allVehicles] = await Promise.all([
      prisma.booking.findMany({ where: { vehicle: { scope: 'PLAYGROUND' } }, include: { renter: true } }),
      prisma.vehicle.findMany({ where: { scope: 'PLAYGROUND' } }),
    ]);
    const evaluation = evaluateExtension({
      booking: toEngineBooking(wasifBooking),
      requestedEndAt,
      bookings: allBookings.map(toEngineBooking),
      vehicles: allVehicles.map(toEngineVehicle),
      settings: engineSettings,
    });

    const partial = evaluation.options.find((o) => o.type === 'PARTIAL');
    expect(partial).toBeTruthy();

    const reassignUnavailable = evaluation.unavailable.find((u) => u.type === 'REASSIGN_NEXT');
    expect(reassignUnavailable?.reason).toMatch(/Turo/);
  });
});

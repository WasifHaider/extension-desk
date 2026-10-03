import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const TZ = process.env.OPERATOR_TIMEZONE ?? 'America/New_York';
const SCOPE = 'PLAYGROUND';

function localAt(dayOffset: number, hour: number, minute = 0): Date {
  return DateTime.now()
    .setZone(TZ)
    .plus({ days: dayOffset })
    .set({ hour, minute, second: 0, millisecond: 0 })
    .toUTC()
    .toJSDate();
}

export async function seedPlayground(prisma: PrismaClient): Promise<void> {
  await prisma.event.deleteMany({ where: { booking: { vehicle: { scope: SCOPE } } } });
  await prisma.charge.deleteMany({ where: { booking: { vehicle: { scope: SCOPE } } } });
  await prisma.extensionRequest.deleteMany({ where: { booking: { vehicle: { scope: SCOPE } } } });
  await prisma.message.deleteMany({ where: { renter: { scope: SCOPE } } });
  await prisma.booking.deleteMany({ where: { vehicle: { scope: SCOPE } } });
  await prisma.renter.deleteMany({ where: { scope: SCOPE } });
  await prisma.vehicle.deleteMany({ where: { scope: SCOPE } });

  const fleet = await Promise.all(
    [
      { name: 'Tesla Model 3', category: 'EV Sedan', seats: 5, dailyRateCents: 8900, plate: 'EV-1001' },
      { name: 'Jeep Wrangler', category: 'SUV', seats: 5, dailyRateCents: 11000, plate: 'SUV-2002' },
      { name: 'Toyota RAV4', category: 'Compact SUV', seats: 5, dailyRateCents: 7500, plate: 'CSV-3003' },
      { name: 'Honda CR-V', category: 'Compact SUV', seats: 5, dailyRateCents: 7200, plate: 'CSV-4004' },
      { name: 'Toyota Corolla', category: 'Economy', seats: 5, dailyRateCents: 5500, plate: 'ECO-5005' },
      { name: 'Nissan Rogue', category: 'Compact SUV', seats: 5, dailyRateCents: 7000, plate: 'CSV-6006' },
      { name: 'Ford Mustang', category: 'Sports Coupe', seats: 4, dailyRateCents: 13000, plate: 'SPC-7007' },
      { name: 'Kia Soul', category: 'Economy', seats: 5, dailyRateCents: 6000, plate: 'ECO-8008' },
    ].map((v) => prisma.vehicle.create({ data: { ...v, scope: SCOPE } })),
  );
  const tesla = fleet[0];

  const wasif = await prisma.renter.create({
    data: { name: 'Muhammad Wasif', phone: '555-0199', scope: SCOPE },
  });

  await prisma.booking.create({
    data: {
      vehicleId: tesla.id,
      renterId: wasif.id,
      source: 'DIRECT',
      status: 'ACTIVE',
      startAt: localAt(-3, 10, 0),
      endAt: localAt(1, 10, 0),
      dailyRateCents: tesla.dailyRateCents,
    },
  });
}

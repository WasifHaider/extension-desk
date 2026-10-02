import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

const TZ = process.env.OPERATOR_TIMEZONE ?? 'America/New_York';

function localAt(dayOffset: number, hour: number, minute = 0): Date {
  return DateTime.now()
    .setZone(TZ)
    .plus({ days: dayOffset })
    .set({ hour, minute, second: 0, millisecond: 0 })
    .toUTC()
    .toJSDate();
}

async function main() {
  await prisma.event.deleteMany();
  await prisma.charge.deleteMany();
  await prisma.extensionRequest.deleteMany();
  await prisma.message.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.renter.deleteMany();
  await prisma.vehicle.deleteMany();

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
    ].map((v) => prisma.vehicle.create({ data: v })),
  );
  const [tesla, wrangler, rav4, , corolla, rogue, mustang, kia] = fleet;

  const renters = await Promise.all(
    [
      { name: 'Maya L.', phone: '555-0101' },
      { name: 'Daniel K.', phone: '555-0102' },
      { name: 'Aisha M.', phone: '555-0103' },
      { name: 'Sam P.', phone: '555-0104' },
      { name: 'Priya N.', phone: '555-0105' },
      { name: 'Leo W.', phone: '555-0106' },
      { name: 'Carla S.', phone: '555-0107' },
      { name: 'Tom R.', phone: '555-0108' },
    ].map((r) => prisma.renter.create({ data: r })),
  );
  const [maya, daniel, aisha, sam, priya, leo, carla, tom] = renters;

  // A. Maya — Tesla, clean yes case. Next booking on the Tesla is 6 days out.
  await prisma.booking.create({
    data: {
      vehicleId: tesla.id,
      renterId: maya.id,
      source: 'DIRECT',
      status: 'ACTIVE',
      startAt: localAt(-3, 10, 0),
      endAt: localAt(1, 10, 0),
      dailyRateCents: tesla.dailyRateCents,
    },
  });
  await prisma.booking.create({
    data: {
      vehicleId: tesla.id,
      renterId: null,
      source: 'TURO',
      status: 'CONFIRMED',
      startAt: localAt(6, 10, 0),
      endAt: localAt(9, 10, 0),
      dailyRateCents: tesla.dailyRateCents,
    },
  });

  // B. Daniel — Wrangler, Turo conflict, has damage cover.
  await prisma.booking.create({
    data: {
      vehicleId: wrangler.id,
      renterId: daniel.id,
      source: 'DIRECT',
      status: 'ACTIVE',
      startAt: localAt(-3, 10, 0),
      endAt: localAt(1, 10, 0),
      dailyRateCents: wrangler.dailyRateCents,
      coverageDailyCents: 1500,
      coverageEndsAt: localAt(1, 10, 0),
    },
  });
  await prisma.booking.create({
    data: {
      vehicleId: wrangler.id,
      renterId: null,
      source: 'TURO',
      status: 'CONFIRMED',
      startAt: localAt(2, 10, 0),
      endAt: localAt(5, 10, 0),
      dailyRateCents: wrangler.dailyRateCents,
    },
  });

  // C. Aisha — RAV4, direct conflict reassignable to the CR-V (kept free).
  await prisma.booking.create({
    data: {
      vehicleId: rav4.id,
      renterId: aisha.id,
      source: 'DIRECT',
      status: 'ACTIVE',
      startAt: localAt(-3, 10, 0),
      endAt: localAt(1, 10, 0),
      dailyRateCents: rav4.dailyRateCents,
    },
  });
  await prisma.booking.create({
    data: {
      vehicleId: rav4.id,
      renterId: tom.id,
      source: 'DIRECT',
      status: 'CONFIRMED',
      startAt: localAt(2, 10, 0),
      endAt: localAt(4, 10, 0),
      dailyRateCents: rav4.dailyRateCents,
    },
  });

  // D. Sam — Corolla, vague message case.
  await prisma.booking.create({
    data: {
      vehicleId: corolla.id,
      renterId: sam.id,
      source: 'DIRECT',
      status: 'ACTIVE',
      startAt: localAt(-3, 10, 0),
      endAt: localAt(1, 10, 0),
      dailyRateCents: corolla.dailyRateCents,
    },
  });

  // F. Priya — Rogue, Turo conflict, partial already offered.
  await prisma.booking.create({
    data: {
      vehicleId: rogue.id,
      renterId: priya.id,
      source: 'DIRECT',
      status: 'ACTIVE',
      startAt: localAt(-3, 10, 0),
      endAt: localAt(1, 10, 0),
      dailyRateCents: rogue.dailyRateCents,
    },
  });
  await prisma.booking.create({
    data: {
      vehicleId: rogue.id,
      renterId: null,
      source: 'TURO',
      status: 'CONFIRMED',
      startAt: localAt(2, 10, 0),
      endAt: localAt(5, 10, 0),
      dailyRateCents: rogue.dailyRateCents,
    },
  });

  // G. Leo — Mustang, Turo conflict so tight nothing can be offered.
  await prisma.booking.create({
    data: {
      vehicleId: mustang.id,
      renterId: leo.id,
      source: 'DIRECT',
      status: 'ACTIVE',
      startAt: localAt(-3, 10, 0),
      endAt: localAt(1, 10, 0),
      dailyRateCents: mustang.dailyRateCents,
    },
  });
  await prisma.booking.create({
    data: {
      vehicleId: mustang.id,
      renterId: null,
      source: 'TURO',
      status: 'CONFIRMED',
      startAt: localAt(1, 12, 0),
      endAt: localAt(4, 12, 0),
      dailyRateCents: mustang.dailyRateCents,
    },
  });

  // E. Carla — Kia Soul, "not an extension" message case.
  await prisma.booking.create({
    data: {
      vehicleId: kia.id,
      renterId: carla.id,
      source: 'DIRECT',
      status: 'ACTIVE',
      startAt: localAt(-3, 10, 0),
      endAt: localAt(1, 10, 0),
      dailyRateCents: kia.dailyRateCents,
    },
  });

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

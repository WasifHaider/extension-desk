import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import { settings } from '../config/settings';
import { resolveInterpretation, InterpretationContext } from '../llm/resolveInterpretation';
import { evaluateExtension } from '../extensions/engine/evaluateExtension';
import { toEngineBooking, toEngineVehicle } from '../extensions/prismaMappers';
import { conflictFoundDetail, alternateCarFoundDetail } from '../extension-requests/eventCopy';
import { partialOfferTemplate, declineTemplate } from '../extension-requests/templates';

const TZ = process.env.OPERATOR_TIMEZONE ?? 'America/New_York';

const engineSettings = {
  turnaroundBufferMinutes: settings.turnaroundBufferMinutes,
  longTripTiers: [...settings.longTripTiers],
  timezone: TZ,
};

function localAt(dayOffset: number, hour: number, minute = 0): Date {
  return DateTime.now()
    .setZone(TZ)
    .plus({ days: dayOffset })
    .set({ hour, minute, second: 0, millisecond: 0 })
    .toUTC()
    .toJSDate();
}

function weekdayOf(dayOffset: number): string {
  return DateTime.now().setZone(TZ).plus({ days: dayOffset }).toFormat('cccc');
}

interface RawParseLike {
  intent: 'EXTEND' | 'OTHER';
  date: string | null;
  weekday: string | null;
  time: string | null;
  time_phrase: 'morning' | 'afternoon' | 'evening' | 'night' | null;
  clarifying_question: string | null;
}

const SCOPE = 'DEMO';

export async function seed(prisma: PrismaClient): Promise<void> {
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

  // --- Pre-seeded extension requests (spec section 12): never call the LLM. ---
  // Each scenario builds the same RawParse shape the LLM would have produced
  // and feeds it straight into the real resolveInterpretation/evaluateExtension
  // guardrail code, so the stored result is exactly what the live path would give.

  async function seedRequest(opts: {
    bookingVehicleId: string;
    renterId: string;
    rawText: string;
    raw: RawParseLike;
    receivedAt: Date;
    outcome?: 'OFFER_SENT' | 'DECLINED';
    declineReasonOverride?: string;
  }) {
    const booking = await prisma.booking.findFirstOrThrow({
      where: { vehicleId: opts.bookingVehicleId, renterId: opts.renterId },
    });

    const message = await prisma.message.create({
      data: {
        renterId: opts.renterId,
        bookingId: booking.id,
        direction: 'IN',
        body: opts.rawText,
        status: 'RECEIVED',
        createdAt: opts.receivedAt,
      },
    });

    const context: InterpretationContext = {
      currentEndAt: booking.endAt,
      timezone: TZ,
      maxExtensionDays: settings.maxExtensionDays,
      vagueTimeDefaults: settings.vagueTimeDefaults,
    };
    const result = resolveInterpretation(opts.raw, context);

    const status: string = result.status === 'RESOLVED' ? 'READY' : result.status;
    const interpretedEndAt: Date | null = result.status === 'RESOLVED' ? result.interpretedEndAt : null;
    const interpretationNote: string | null = result.status === 'NOT_EXTENSION' ? null : result.interpretationNote;

    let evaluation: ReturnType<typeof evaluateExtension> | null = null;
    if (result.status === 'RESOLVED') {
      const [allBookingRows, allVehicles] = await Promise.all([
        prisma.booking.findMany({ where: { vehicle: { scope: SCOPE } }, include: { renter: true } }),
        prisma.vehicle.findMany({ where: { scope: SCOPE } }),
      ]);
      evaluation = evaluateExtension({
        booking: toEngineBooking(booking),
        requestedEndAt: interpretedEndAt!,
        bookings: allBookingRows.map(toEngineBooking),
        vehicles: allVehicles.map(toEngineVehicle),
        settings: engineSettings,
      });

      const extensionRequest = await prisma.extensionRequest.create({
        data: {
          bookingId: booking.id,
          messageId: message.id,
          rawText: opts.rawText,
          intent: opts.raw.intent,
          parsedJson: JSON.stringify(opts.raw),
          originalEndAt: booking.endAt,
          interpretedEndAt,
          interpretationNote,
          status,
          optionsJson: JSON.stringify(evaluation),
          createdAt: opts.receivedAt,
        },
      });

      await prisma.event.create({
        data: {
          extensionRequestId: extensionRequest.id,
          bookingId: booking.id,
          type: 'MESSAGE_RECEIVED',
          detail: 'Request received',
          createdAt: opts.receivedAt,
        },
      });
      await prisma.event.create({
        data: {
          extensionRequestId: extensionRequest.id,
          bookingId: booking.id,
          type: 'PARSED',
          detail: interpretationNote ?? status,
          createdAt: opts.receivedAt,
        },
      });

      if (evaluation.conflicts.length > 0) {
        await prisma.event.create({
          data: {
            extensionRequestId: extensionRequest.id,
            bookingId: booking.id,
            type: 'CONFLICT_FOUND',
            detail: conflictFoundDetail(evaluation.conflicts[0], TZ),
            createdAt: opts.receivedAt,
          },
        });
        const reassign = evaluation.options.find((o) => o.type === 'REASSIGN_NEXT');
        if (reassign?.reassign) {
          const toVehicle = allVehicles.find((v) => v.id === reassign.reassign!.toVehicleId);
          if (toVehicle) {
            await prisma.event.create({
              data: {
                extensionRequestId: extensionRequest.id,
                bookingId: booking.id,
                type: 'ALTERNATE_CAR_FOUND',
                detail: alternateCarFoundDetail(toVehicle.name),
                createdAt: opts.receivedAt,
              },
            });
          }
        }
      }

      if (opts.outcome === 'OFFER_SENT') {
        const partial = evaluation.options.find((o) => o.type === 'PARTIAL');
        if (!partial || !partial.quote) {
          throw new Error('seedRequest: OFFER_SENT scenario has no PARTIAL option');
        }
        const vehicle = allVehicles.find((v) => v.id === opts.bookingVehicleId)!;
        await prisma.message.create({
          data: {
            renterId: opts.renterId,
            bookingId: booking.id,
            direction: 'OUT',
            body: partialOfferTemplate(vehicle.name, partial.newEndAt, partial.quote.totalCents, TZ),
            status: 'QUEUED',
          },
        });
        await prisma.extensionRequest.update({ where: { id: extensionRequest.id }, data: { status: 'OFFERED' } });
        await prisma.event.create({
          data: { extensionRequestId: extensionRequest.id, bookingId: booking.id, type: 'OFFER_SENT', detail: 'Offer sent' },
        });
      }

      if (opts.outcome === 'DECLINED') {
        const reason =
          opts.declineReasonOverride ?? evaluation.unavailable.find((u) => u.type === 'FULL')?.reason ?? 'no availability';
        await prisma.message.create({
          data: {
            renterId: opts.renterId,
            bookingId: booking.id,
            direction: 'OUT',
            body: declineTemplate(reason, booking.endAt, TZ),
            status: 'QUEUED',
          },
        });
        await prisma.extensionRequest.update({
          where: { id: extensionRequest.id },
          data: { status: 'DECLINED', declineReason: reason, decidedAt: new Date() },
        });
        await prisma.event.create({
          data: { extensionRequestId: extensionRequest.id, bookingId: booking.id, type: 'DECLINED', detail: `Declined: ${reason}` },
        });
      }
    } else {
      const extensionRequest = await prisma.extensionRequest.create({
        data: {
          bookingId: booking.id,
          messageId: message.id,
          rawText: opts.rawText,
          intent: opts.raw.intent,
          parsedJson: JSON.stringify(opts.raw),
          originalEndAt: booking.endAt,
          interpretedEndAt: null,
          interpretationNote,
          status,
          optionsJson: null,
          createdAt: opts.receivedAt,
        },
      });
      await prisma.event.create({
        data: {
          extensionRequestId: extensionRequest.id,
          bookingId: booking.id,
          type: 'MESSAGE_RECEIVED',
          detail: 'Request received',
          createdAt: opts.receivedAt,
        },
      });
      await prisma.event.create({
        data: {
          extensionRequestId: extensionRequest.id,
          bookingId: booking.id,
          type: 'PARSED',
          detail: interpretationNote ?? status,
          createdAt: opts.receivedAt,
        },
      });
    }
  }

  const now = DateTime.now().setZone(TZ);

  // B. Daniel — Turo conflict, pre-seeded, READY (operator sends the offer live in the demo).
  await seedRequest({
    bookingVehicleId: wrangler.id,
    renterId: daniel.id,
    rawText: `any chance I can keep the jeep till ${weekdayOf(3).toLowerCase()} night?`,
    raw: {
      intent: 'EXTEND',
      date: now.plus({ days: 3 }).toFormat('yyyy-LL-dd'),
      weekday: weekdayOf(3),
      time: null,
      time_phrase: 'night',
      clarifying_question: null,
    },
    receivedAt: now.minus({ minutes: 28 }).toJSDate(),
  });

  // D. Sam — vague message, pre-seeded, NEEDS_DATE.
  await seedRequest({
    bookingVehicleId: corolla.id,
    renterId: sam.id,
    rawText: 'hey could I keep it a bit longer?',
    raw: {
      intent: 'EXTEND',
      date: null,
      weekday: null,
      time: null,
      time_phrase: null,
      clarifying_question: 'Happy to help! What day and time would you like to return the Corolla?',
    },
    receivedAt: now.minus({ minutes: 4 }).toJSDate(),
  });

  // F. Priya — Turo conflict, pre-seeded, already OFFERED.
  await seedRequest({
    bookingVehicleId: rogue.id,
    renterId: priya.id,
    rawText: `could I have it until ${weekdayOf(2).toLowerCase()} noon?`,
    raw: {
      intent: 'EXTEND',
      date: now.plus({ days: 2 }).toFormat('yyyy-LL-dd'),
      weekday: weekdayOf(2),
      time: '12:00',
      time_phrase: null,
      clarifying_question: null,
    },
    receivedAt: now.minus({ hours: 4 }).toJSDate(),
    outcome: 'OFFER_SENT',
  });

  // G. Leo — Turo conflict too tight to offer anything, pre-seeded, DECLINED.
  await seedRequest({
    bookingVehicleId: mustang.id,
    renterId: leo.id,
    rawText: `extend through ${weekdayOf(4).toLowerCase()} please`,
    raw: {
      intent: 'EXTEND',
      date: now.plus({ days: 4 }).toFormat('yyyy-LL-dd'),
      weekday: weekdayOf(4),
      time: null,
      time_phrase: null,
      clarifying_question: null,
    },
    receivedAt: now.minus({ days: 1, hours: 2 }).toJSDate(),
    outcome: 'DECLINED',
  });

  // E. Carla — not an extension, pre-seeded, NOT_EXTENSION (greyed in the inbox).
  await seedRequest({
    bookingVehicleId: kia.id,
    renterId: carla.id,
    rawText: 'where do I drop the keys?',
    raw: { intent: 'OTHER', date: null, weekday: null, time: null, time_phrase: null, clarifying_question: null },
    receivedAt: now.minus({ days: 1, hours: 3 }).toJSDate(),
  });
}

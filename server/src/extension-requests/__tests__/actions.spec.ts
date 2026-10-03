import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ExtensionRequestsService } from '../extension-requests.service';
import { MockPaymentProvider } from '../../payments/paymentProvider';
import { evaluateExtension } from '../../extensions/engine/evaluateExtension';
import { toEngineBooking, toEngineVehicle } from '../../extensions/prismaMappers';
import { settings } from '../../config/settings';

const engineSettings = {
  turnaroundBufferMinutes: settings.turnaroundBufferMinutes,
  longTripTiers: [...settings.longTripTiers],
  timezone: settings.timezone,
};

const prisma = new PrismaService();
const service = new ExtensionRequestsService(prisma, new MockPaymentProvider());

const createdVehicleIds: string[] = [];
const createdRenterIds: string[] = [];
const createdBookingIds: string[] = [];
const createdExtensionRequestIds: string[] = [];
const createdMessageIds: string[] = [];

async function makeVehicle(name: string) {
  const v = await prisma.vehicle.create({
    data: { name, category: 'Economy', seats: 5, dailyRateCents: 10000, plate: name },
  });
  createdVehicleIds.push(v.id);
  return v;
}

async function makeRenter(name: string) {
  const r = await prisma.renter.create({ data: { name, phone: '555-0100' } });
  createdRenterIds.push(r.id);
  return r;
}

async function makeBooking(params: {
  vehicleId: string;
  renterId: string;
  startAt: Date;
  endAt: Date;
  source?: string;
  status?: string;
}) {
  const b = await prisma.booking.create({
    data: {
      vehicleId: params.vehicleId,
      renterId: params.renterId,
      source: params.source ?? 'DIRECT',
      status: params.status ?? 'ACTIVE',
      startAt: params.startAt,
      endAt: params.endAt,
      dailyRateCents: 10000,
      coverageDailyCents: 0,
    },
  });
  createdBookingIds.push(b.id);
  return b;
}

async function makeExtensionRequest(params: {
  bookingId: string;
  renterId: string;
  originalEndAt: Date;
  interpretedEndAt: Date;
  status: string;
  optionsJson: string;
}) {
  const message = await prisma.message.create({
    data: {
      renterId: params.renterId,
      bookingId: params.bookingId,
      direction: 'IN',
      body: 'test message',
      status: 'RECEIVED',
    },
  });
  createdMessageIds.push(message.id);

  const extReq = await prisma.extensionRequest.create({
    data: {
      bookingId: params.bookingId,
      messageId: message.id,
      rawText: 'test message',
      intent: 'EXTEND',
      originalEndAt: params.originalEndAt,
      interpretedEndAt: params.interpretedEndAt,
      interpretationNote: 'test',
      status: params.status,
      optionsJson: params.optionsJson,
    },
  });
  createdExtensionRequestIds.push(extReq.id);
  return extReq;
}

afterAll(async () => {
  await prisma.charge.deleteMany({ where: { extensionRequestId: { in: createdExtensionRequestIds } } });
  await prisma.event.deleteMany({ where: { extensionRequestId: { in: createdExtensionRequestIds } } });
  await prisma.extensionRequest.deleteMany({ where: { id: { in: createdExtensionRequestIds } } });
  await prisma.message.deleteMany({ where: { id: { in: createdMessageIds } } });
  await prisma.message.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.vehicle.deleteMany({ where: { id: { in: createdVehicleIds } } });
  await prisma.renter.deleteMany({ where: { id: { in: createdRenterIds } } });
  await prisma.$disconnect();
});

describe('extension request actions', () => {
  it('double approve: second call is 409 and exactly one Charge exists', async () => {
    const vehicle = await makeVehicle('Double Approve Car');
    const renter = await makeRenter('Double Approve Renter');
    const now = new Date();
    const endAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const booking = await makeBooking({ vehicleId: vehicle.id, renterId: renter.id, startAt: now, endAt });
    const requestedEndAt = new Date(endAt.getTime() + 2 * 24 * 60 * 60 * 1000);

    const evaluation = evaluateExtension({
      booking: toEngineBooking(booking),
      requestedEndAt,
      bookings: [toEngineBooking(booking)],
      vehicles: [toEngineVehicle(vehicle)],
      settings: engineSettings,
    });
    expect(evaluation.options.find((o) => o.type === 'FULL')).toBeTruthy();

    const extReq = await makeExtensionRequest({
      bookingId: booking.id,
      renterId: renter.id,
      originalEndAt: endAt,
      interpretedEndAt: requestedEndAt,
      status: 'READY',
      optionsJson: JSON.stringify(evaluation),
    });

    const first = await service.approve(extReq.id, 'FULL');
    expect(first.conflict).toBe(false);

    await expect(service.approve(extReq.id, 'FULL')).rejects.toBeInstanceOf(ConflictException);

    const charges = await prisma.charge.findMany({ where: { extensionRequestId: extReq.id } });
    expect(charges).toHaveLength(1);
  });

  it('calendar changed between evaluate and approve: 409 and options are refreshed', async () => {
    const vehicle = await makeVehicle('Calendar Changed Car');
    const renter = await makeRenter('Calendar Changed Renter');
    const now = new Date();
    const endAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const booking = await makeBooking({ vehicleId: vehicle.id, renterId: renter.id, startAt: now, endAt });
    const requestedEndAt = new Date(endAt.getTime() + 3 * 24 * 60 * 60 * 1000);

    const evaluationBefore = evaluateExtension({
      booking: toEngineBooking(booking),
      requestedEndAt,
      bookings: [toEngineBooking(booking)],
      vehicles: [toEngineVehicle(vehicle)],
      settings: engineSettings,
    });
    expect(evaluationBefore.options.find((o) => o.type === 'FULL')).toBeTruthy();

    const extReq = await makeExtensionRequest({
      bookingId: booking.id,
      renterId: renter.id,
      originalEndAt: endAt,
      interpretedEndAt: requestedEndAt,
      status: 'READY',
      optionsJson: JSON.stringify(evaluationBefore),
    });

    // calendar changes after evaluation: a Turo booking lands right after the current end
    const conflictingBooking = await prisma.booking.create({
      data: {
        vehicleId: vehicle.id,
        renterId: null,
        source: 'TURO',
        status: 'CONFIRMED',
        startAt: new Date(endAt.getTime() + 60 * 60 * 1000),
        endAt: new Date(endAt.getTime() + 25 * 60 * 60 * 1000),
        dailyRateCents: 10000,
        coverageDailyCents: 0,
      },
    });
    createdBookingIds.push(conflictingBooking.id);

    await expect(service.approve(extReq.id, 'FULL')).rejects.toBeInstanceOf(ConflictException);

    const refreshed = await prisma.extensionRequest.findUniqueOrThrow({ where: { id: extReq.id } });
    const refreshedOptions = JSON.parse(refreshed.optionsJson!);
    expect(refreshedOptions.options.find((o: { type: string }) => o.type === 'FULL')).toBeFalsy();
    expect(refreshedOptions.unavailable.find((u: { type: string }) => u.type === 'FULL')).toBeTruthy();

    const charges = await prisma.charge.findMany({ where: { extensionRequestId: extReq.id } });
    expect(charges).toHaveLength(0);
  });

  it('an OFFERED partial is not charged until accepted', async () => {
    const vehicle = await makeVehicle('Offered Partial Car');
    const renter = await makeRenter('Offered Partial Renter');
    const now = new Date();
    const endAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const booking = await makeBooking({ vehicleId: vehicle.id, renterId: renter.id, startAt: now, endAt });

    const conflictingBooking = await prisma.booking.create({
      data: {
        vehicleId: vehicle.id,
        renterId: null,
        source: 'TURO',
        status: 'CONFIRMED',
        startAt: new Date(endAt.getTime() + 3 * 60 * 60 * 1000),
        endAt: new Date(endAt.getTime() + 27 * 60 * 60 * 1000),
        dailyRateCents: 10000,
        coverageDailyCents: 0,
      },
    });
    createdBookingIds.push(conflictingBooking.id);

    const requestedEndAt = new Date(endAt.getTime() + 2 * 24 * 60 * 60 * 1000);
    const evaluation = evaluateExtension({
      booking: toEngineBooking(booking),
      requestedEndAt,
      bookings: [toEngineBooking(booking), toEngineBooking(conflictingBooking)],
      vehicles: [toEngineVehicle(vehicle)],
      settings: engineSettings,
    });
    const partial = evaluation.options.find((o) => o.type === 'PARTIAL');
    expect(partial).toBeTruthy();

    const extReq = await makeExtensionRequest({
      bookingId: booking.id,
      renterId: renter.id,
      originalEndAt: endAt,
      interpretedEndAt: requestedEndAt,
      status: 'READY',
      optionsJson: JSON.stringify(evaluation),
    });

    await service.offer(extReq.id);
    const afterOffer = await prisma.extensionRequest.findUniqueOrThrow({ where: { id: extReq.id } });
    expect(afterOffer.status).toBe('OFFERED');

    const chargesAfterOffer = await prisma.charge.findMany({ where: { extensionRequestId: extReq.id } });
    expect(chargesAfterOffer).toHaveLength(0);

    const queuedMessages = await prisma.message.findMany({
      where: { bookingId: booking.id, direction: 'OUT' },
    });
    expect(queuedMessages.length).toBeGreaterThanOrEqual(1);

    const accepted = await service.approve(extReq.id, 'PARTIAL');
    expect(accepted.conflict).toBe(false);

    const chargesAfterAccept = await prisma.charge.findMany({ where: { extensionRequestId: extReq.id } });
    expect(chargesAfterAccept).toHaveLength(1);
  });
});

import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma.service';
import { settings } from '../config/settings';
import { evaluateExtension } from '../extensions/engine/evaluateExtension';
import { toEngineBooking, toEngineVehicle } from '../extensions/prismaMappers';
import { Evaluation, OptionType } from '../extensions/engine/types';
import { PAYMENT_PROVIDER } from './payment-provider.token';
import { PaymentProvider } from '../payments/paymentProvider';
import { resolveInterpretation } from '../llm/resolveInterpretation';
import {
  clarifyFallbackTemplate,
  declineTemplate,
  fullConfirmationTemplate,
  partialOfferTemplate,
  reassignNextRenterTemplate,
} from './templates';
import { conflictFoundDetail, alternateCarFoundDetail } from './eventCopy';

type Tx = Prisma.TransactionClient;

const engineSettings = {
  turnaroundBufferMinutes: settings.turnaroundBufferMinutes,
  longTripTiers: [...settings.longTripTiers],
  timezone: settings.timezone,
};

async function reEvaluate(tx: Tx, bookingId: string, requestedEndAt: Date): Promise<Evaluation> {
  const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const [allBookings, allVehicles] = await Promise.all([tx.booking.findMany(), tx.vehicle.findMany()]);
  return evaluateExtension({
    booking: toEngineBooking(booking),
    requestedEndAt,
    bookings: allBookings.map(toEngineBooking),
    vehicles: allVehicles.map(toEngineVehicle),
    settings: engineSettings,
  });
}

function findOption(evaluation: Evaluation, optionType: OptionType) {
  return evaluation.options.find((o) => o.type === optionType) ?? null;
}

@Injectable()
export class ExtensionRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  async approve(id: string, optionType: OptionType) {
    if (optionType !== 'FULL' && optionType !== 'REASSIGN_NEXT' && optionType !== 'PARTIAL') {
      throw new BadRequestException('Unsupported optionType for approve');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const extReq = await tx.extensionRequest.findUnique({ where: { id } });
      if (!extReq) {
        throw new NotFoundException('Extension request not found');
      }
      const isPartialAccept = optionType === 'PARTIAL' && extReq.status === 'OFFERED';
      if (extReq.status !== 'READY' && !isPartialAccept) {
        throw new ConflictException('Request is not ready for approval');
      }
      if (!extReq.interpretedEndAt) {
        throw new ConflictException('No interpreted date to approve');
      }

      const priorOptions: Evaluation = extReq.optionsJson ? JSON.parse(extReq.optionsJson) : null;
      const priorChosen = priorOptions ? priorOptions.options.find((o) => o.type === optionType) : null;
      if (!priorChosen) {
        throw new ConflictException('Chosen option is no longer on offer');
      }

      const evaluation = await reEvaluate(tx, extReq.bookingId, new Date(extReq.interpretedEndAt));
      const chosen = findOption(evaluation, optionType);

      if (!chosen || new Date(chosen.newEndAt).getTime() !== new Date(priorChosen.newEndAt).getTime()) {
        await tx.extensionRequest.update({
          where: { id },
          data: { optionsJson: JSON.stringify(evaluation) },
        });
        return { conflict: true as const };
      }

      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: extReq.bookingId },
        include: { vehicle: true },
      });
      const newEndAt = new Date(chosen.newEndAt);
      const quote = chosen.quote!;

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          endAt: newEndAt,
          ...(booking.coverageDailyCents > 0 ? { coverageEndsAt: newEndAt } : {}),
        },
      });

      let reassignedVehicleName: string | null = null;
      if (optionType === 'REASSIGN_NEXT' && chosen.reassign) {
        const nextBooking = await tx.booking.findUniqueOrThrow({ where: { id: chosen.reassign.bookingId } });
        const toVehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: chosen.reassign.toVehicleId } });
        await tx.booking.update({
          where: { id: nextBooking.id },
          data: { vehicleId: toVehicle.id },
        });
        reassignedVehicleName = toVehicle.name;

        if (nextBooking.renterId) {
          const body = reassignNextRenterTemplate(
            nextBooking.startAt,
            toVehicle.name,
            booking.vehicle.name,
            settings.timezone,
          );
          await tx.message.create({
            data: {
              renterId: nextBooking.renterId,
              bookingId: nextBooking.id,
              direction: 'OUT',
              body,
              status: 'QUEUED',
            },
          });
          await tx.event.create({
            data: { bookingId: nextBooking.id, type: 'MESSAGE_QUEUED', detail: 'Message queued' },
          });
        }
      }

      const charge = await tx.charge.create({
        data: {
          bookingId: booking.id,
          extensionRequestId: id,
          amountCents: quote.totalCents,
          status: 'CHARGED',
          providerRef: (await this.paymentProvider.charge({ bookingId: booking.id, amountCents: quote.totalCents }))
            .providerRef,
        },
      });

      if (booking.renterId) {
        const confirmationBody = fullConfirmationTemplate(
          booking.vehicle.name,
          newEndAt,
          quote.totalCents,
          settings.timezone,
        );
        await tx.message.create({
          data: {
            renterId: booking.renterId,
            bookingId: booking.id,
            direction: 'OUT',
            body: confirmationBody,
            status: 'QUEUED',
          },
        });
      }

      await tx.extensionRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          chosenOptionType: optionType,
          chosenEndAt: newEndAt,
          decidedAt: new Date(),
          optionsJson: JSON.stringify(evaluation),
        },
      });

      await tx.event.create({ data: { extensionRequestId: id, bookingId: booking.id, type: 'APPROVED', detail: 'Approved' } });
      await tx.event.create({
        data: { extensionRequestId: id, bookingId: booking.id, type: 'BOOKING_EXTENDED', detail: 'Booking extended' },
      });
      if (reassignedVehicleName) {
        await tx.event.create({
          data: {
            extensionRequestId: id,
            bookingId: booking.id,
            type: 'REASSIGNED',
            detail: `Next renter moved to ${reassignedVehicleName}`,
          },
        });
      }
      await tx.event.create({
        data: {
          extensionRequestId: id,
          bookingId: booking.id,
          type: 'CHARGED',
          detail: `Charged ${(quote.totalCents / 100).toFixed(2)}`,
        },
      });
      await tx.event.create({
        data: { extensionRequestId: id, bookingId: booking.id, type: 'MESSAGE_QUEUED', detail: 'Message queued' },
      });

      return { conflict: false as const, chargeId: charge.id };
    });

    if (result.conflict) {
      throw new ConflictException('Calendar changed — re-evaluated');
    }
    return result;
  }

  async offer(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const extReq = await tx.extensionRequest.findUnique({
        where: { id },
        include: { booking: { include: { vehicle: true } } },
      });
      if (!extReq) {
        throw new NotFoundException('Extension request not found');
      }
      if (extReq.status !== 'READY') {
        throw new ConflictException('Request is not ready to offer');
      }
      const options: Evaluation = extReq.optionsJson ? JSON.parse(extReq.optionsJson) : null;
      const partial = options ? options.options.find((o) => o.type === 'PARTIAL') : null;
      if (!partial || !partial.quote) {
        throw new ConflictException('No partial option to offer');
      }

      if (extReq.booking.renterId) {
        const body = partialOfferTemplate(
          extReq.booking.vehicle.name,
          new Date(partial.newEndAt),
          partial.quote.totalCents,
          settings.timezone,
        );
        await tx.message.create({
          data: {
            renterId: extReq.booking.renterId,
            bookingId: extReq.bookingId,
            direction: 'OUT',
            body,
            status: 'QUEUED',
          },
        });
      }

      await tx.extensionRequest.update({ where: { id }, data: { status: 'OFFERED' } });
      await tx.event.create({
        data: { extensionRequestId: id, bookingId: extReq.bookingId, type: 'OFFER_SENT', detail: 'Offer sent' },
      });

      return { ok: true as const };
    });
  }

  async decline(id: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const extReq = await tx.extensionRequest.findUnique({
        where: { id },
        include: { booking: { include: { vehicle: true } } },
      });
      if (!extReq) {
        throw new NotFoundException('Extension request not found');
      }
      if (extReq.status === 'APPROVED' || extReq.status === 'DECLINED') {
        throw new ConflictException('Request already decided');
      }

      if (extReq.booking.renterId) {
        const body = declineTemplate(reason, extReq.booking.endAt, settings.timezone);
        await tx.message.create({
          data: {
            renterId: extReq.booking.renterId,
            bookingId: extReq.bookingId,
            direction: 'OUT',
            body,
            status: 'QUEUED',
          },
        });
      }

      await tx.extensionRequest.update({
        where: { id },
        data: { status: 'DECLINED', declineReason: reason, decidedAt: new Date() },
      });
      await tx.event.create({
        data: {
          extensionRequestId: id,
          bookingId: extReq.bookingId,
          type: 'DECLINED',
          detail: `Declined: ${reason}`,
        },
      });

      return { ok: true as const };
    });
  }

  async setInterpretation(id: string, requestedEndAt: Date) {
    return this.prisma.$transaction(async (tx) => {
      const extReq = await tx.extensionRequest.findUnique({ where: { id } });
      if (!extReq) {
        throw new NotFoundException('Extension request not found');
      }
      if (extReq.status !== 'READY' && extReq.status !== 'NEEDS_DATE') {
        throw new ConflictException('Interpretation can only be edited from READY or NEEDS_DATE');
      }

      const booking = await tx.booking.findUniqueOrThrow({ where: { id: extReq.bookingId } });
      const syntheticRaw = {
        intent: 'EXTEND' as const,
        date: toDateOnlyIso(requestedEndAt, settings.timezone),
        weekday: null,
        time: toHHmm(requestedEndAt, settings.timezone),
        time_phrase: null,
        clarifying_question: null,
      };

      const result = resolveInterpretation(syntheticRaw, {
        currentEndAt: booking.endAt,
        timezone: settings.timezone,
        maxExtensionDays: settings.maxExtensionDays,
        vagueTimeDefaults: settings.vagueTimeDefaults,
      });

      if (result.status === 'RESOLVED') {
        const [allBookings, allVehicles] = await Promise.all([
          tx.booking.findMany({ include: { renter: true } }),
          tx.vehicle.findMany(),
        ]);
        const evaluation = evaluateExtension({
          booking: toEngineBooking(booking),
          requestedEndAt: result.interpretedEndAt,
          bookings: allBookings.map(toEngineBooking),
          vehicles: allVehicles.map(toEngineVehicle),
          settings: engineSettings,
        });
        await tx.extensionRequest.update({
          where: { id },
          data: {
            status: 'READY',
            interpretedEndAt: result.interpretedEndAt,
            interpretationNote: result.interpretationNote,
            optionsJson: JSON.stringify(evaluation),
          },
        });
        if (evaluation.conflicts.length > 0) {
          await tx.event.create({
            data: {
              extensionRequestId: id,
              bookingId: extReq.bookingId,
              type: 'CONFLICT_FOUND',
              detail: conflictFoundDetail(evaluation.conflicts[0], settings.timezone),
            },
          });
          const reassign = evaluation.options.find((o) => o.type === 'REASSIGN_NEXT');
          if (reassign?.reassign) {
            const toVehicle = allVehicles.find((v) => v.id === reassign.reassign!.toVehicleId);
            if (toVehicle) {
              await tx.event.create({
                data: {
                  extensionRequestId: id,
                  bookingId: extReq.bookingId,
                  type: 'ALTERNATE_CAR_FOUND',
                  detail: alternateCarFoundDetail(toVehicle.name),
                },
              });
            }
          }
        }
      } else {
        await tx.extensionRequest.update({
          where: { id },
          data: {
            status: 'NEEDS_DATE',
            interpretedEndAt: null,
            interpretationNote: result.status === 'NEEDS_DATE' ? result.interpretationNote : null,
            optionsJson: null,
          },
        });
      }

      await tx.event.create({
        data: {
          extensionRequestId: id,
          bookingId: extReq.bookingId,
          type: 'INTERPRETATION_SET',
          detail: result.status === 'RESOLVED' ? result.interpretationNote : result.status === 'NEEDS_DATE' ? result.interpretationNote : 'NOT_EXTENSION',
        },
      });

      return tx.extensionRequest.findUniqueOrThrow({ where: { id } });
    });
  }

  async clarify(id: string, body: string) {
    return this.prisma.$transaction(async (tx) => {
      const extReq = await tx.extensionRequest.findUnique({
        where: { id },
        include: { booking: { include: { vehicle: true } } },
      });
      if (!extReq) {
        throw new NotFoundException('Extension request not found');
      }

      const text = body?.trim() || clarifyFallbackTemplate(extReq.booking.vehicle.name);

      if (extReq.booking.renterId) {
        await tx.message.create({
          data: {
            renterId: extReq.booking.renterId,
            bookingId: extReq.bookingId,
            direction: 'OUT',
            body: text,
            status: 'QUEUED',
          },
        });
      }

      await tx.event.create({
        data: { extensionRequestId: id, bookingId: extReq.bookingId, type: 'MESSAGE_QUEUED', detail: 'Message queued' },
      });

      return { ok: true as const };
    });
  }
}

function toDateOnlyIso(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timezone).toFormat('yyyy-LL-dd');
}

function toHHmm(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timezone).toFormat('HH:mm');
}

import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma.service';
import { settings } from '../config/settings';
import { evaluateExtension } from '../extensions/engine/evaluateExtension';
import { quoteExtension, formatMoney } from '../extensions/engine/quoteExtension';
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
  const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { vehicle: true } });
  const scope = booking.vehicle.scope;
  const [allBookings, allVehicles] = await Promise.all([
    tx.booking.findMany({ where: { vehicle: { scope } } }),
    tx.vehicle.findMany({ where: { scope } }),
  ]);
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

const AFFIRMATIVE = /^\s*(yes|yeah|yep|yup|sure|ok(ay)?|confirm(ed)?|sounds good|go ahead)\b/i;

function isAffirmative(body: string): boolean {
  return AFFIRMATIVE.test(body);
}

type Badge = 'CLEAN' | 'CONFLICT' | 'NEEDS_DATE' | 'OFFERED' | 'APPROVED' | 'DECLINED' | 'NOT_EXTENSION';

function badgeFor(status: string, hasConflicts: boolean): Badge {
  if (status === 'READY') {
    return hasConflicts ? 'CONFLICT' : 'CLEAN';
  }
  return status as Badge;
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
      if (isPartialAccept) {
        const offerSentEvent = await tx.event.findFirst({
          where: { extensionRequestId: id, type: 'OFFER_SENT' },
          orderBy: { createdAt: 'desc' },
        });
        const replies = offerSentEvent
          ? await tx.message.findMany({
              where: { bookingId: extReq.bookingId, direction: 'IN', createdAt: { gt: offerSentEvent.createdAt } },
            })
          : [];
        if (!replies.some((m) => isAffirmative(m.body))) {
          throw new ConflictException('Renter has not confirmed the offer yet');
        }
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
          detail: `Charged ${formatMoney(quote.totalCents)}`,
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

      const booking = await tx.booking.findUniqueOrThrow({ where: { id: extReq.bookingId }, include: { vehicle: true } });
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
        const scope = booking.vehicle.scope;
        const [allBookings, allVehicles] = await Promise.all([
          tx.booking.findMany({ where: { vehicle: { scope } }, include: { renter: true } }),
          tx.vehicle.findMany({ where: { scope } }),
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

  async listInbox(scope: string = 'DEMO') {
    const requests = await this.prisma.extensionRequest.findMany({
      where: { booking: { vehicle: { scope } } },
      include: { booking: { include: { vehicle: true, renter: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((r) => {
      const hasConflicts = !!r.optionsJson && (JSON.parse(r.optionsJson) as Evaluation).conflicts.length > 0;
      return {
        id: r.id,
        createdAt: r.createdAt,
        renterName: r.booking.renter?.name ?? 'Turo guest',
        vehicleName: r.booking.vehicle.name,
        preview: r.rawText,
        status: r.status,
        badge: badgeFor(r.status, hasConflicts),
      };
    });
  }

  async getDetail(id: string) {
    const extReq = await this.prisma.extensionRequest.findUnique({
      where: { id },
      include: {
        booking: { include: { vehicle: true, renter: true } },
        message: true,
        charges: true,
        events: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!extReq) {
      throw new NotFoundException('Extension request not found');
    }

    const scope = extReq.booking.vehicle.scope;
    const [allBookingRows, allVehicles] = await Promise.all([
      this.prisma.booking.findMany({ where: { vehicle: { scope } }, include: { renter: true } }),
      this.prisma.vehicle.findMany({ where: { scope } }),
    ]);

    const requestedEndAtForEval = extReq.interpretedEndAt ?? extReq.chosenEndAt ?? extReq.booking.endAt;
    const evaluation = evaluateExtension({
      booking: toEngineBooking(extReq.booking),
      requestedEndAt: requestedEndAtForEval,
      bookings: allBookingRows.map(toEngineBooking),
      vehicles: allVehicles.map(toEngineVehicle),
      settings: engineSettings,
    });

    const nextBooking = evaluation.nextBooking;
    const nextBookingRow = nextBooking ? allBookingRows.find((b) => b.id === nextBooking.id) ?? null : null;

    const reassignOption = evaluation.options.find((o) => o.type === 'REASSIGN_NEXT');
    const reassignInfo = reassignOption?.reassign
      ? {
          bookingId: reassignOption.reassign.bookingId,
          toVehicleName: allVehicles.find((v) => v.id === reassignOption.reassign!.toVehicleId)?.name ?? '',
          toVehicleCategory: allVehicles.find((v) => v.id === reassignOption.reassign!.toVehicleId)?.category ?? '',
          nextRenterName: allBookingRows.find((b) => b.id === reassignOption.reassign!.bookingId)?.renter?.name ?? '',
        }
      : null;

    const receipt =
      extReq.status === 'APPROVED' && extReq.chosenOptionType && extReq.chosenEndAt
        ? quoteExtension(
            toEngineBooking({ ...extReq.booking, endAt: extReq.originalEndAt }),
            extReq.chosenEndAt,
            engineSettings,
          ).lineItems
        : null;

    let renterConfirmed = false;
    if (extReq.status === 'OFFERED') {
      const offerSentAt = extReq.events.find((e) => e.type === 'OFFER_SENT')?.createdAt;
      if (offerSentAt) {
        const replies = await this.prisma.message.findMany({
          where: { bookingId: extReq.bookingId, direction: 'IN', createdAt: { gt: offerSentAt } },
        });
        renterConfirmed = replies.some((m) => isAffirmative(m.body));
      }
    }

    return {
      id: extReq.id,
      status: extReq.status,
      createdAt: extReq.createdAt,
      decidedAt: extReq.decidedAt,
      rawText: extReq.rawText,
      message: { body: extReq.message.body, createdAt: extReq.message.createdAt },
      renter: extReq.booking.renter ? { id: extReq.booking.renter.id, name: extReq.booking.renter.name } : null,
      vehicle: {
        id: extReq.booking.vehicle.id,
        name: extReq.booking.vehicle.name,
        category: extReq.booking.vehicle.category,
      },
      hasCover: extReq.booking.coverageDailyCents > 0,
      originalEndAt: extReq.originalEndAt,
      currentEndAt: extReq.booking.endAt,
      interpretedEndAt: extReq.interpretedEndAt,
      interpretationNote: extReq.interpretationNote,
      clarifyingQuestionDraft:
        extReq.status === 'NEEDS_DATE'
          ? (extReq.parsedJson ? JSON.parse(extReq.parsedJson).clarifying_question ?? null : null) ??
            clarifyFallbackTemplate(extReq.booking.vehicle.name)
          : null,
      options: evaluation.options.filter((o) => o.type !== 'DECLINE'),
      unavailable: evaluation.unavailable,
      conflicts: evaluation.conflicts,
      latestFreeEnd: evaluation.latestFreeEnd,
      freeUntil: evaluation.freeUntil,
      nextBooking: nextBookingRow
        ? {
            id: nextBookingRow.id,
            source: nextBookingRow.source,
            startAt: nextBookingRow.startAt,
            endAt: nextBookingRow.endAt,
            renterName: nextBookingRow.renter?.name ?? null,
          }
        : null,
      reassign: reassignInfo,
      chosenOptionType: extReq.chosenOptionType,
      chosenEndAt: extReq.chosenEndAt,
      declineReason: extReq.declineReason,
      charge: extReq.charges[0] ? { amountCents: extReq.charges[0].amountCents } : null,
      receipt,
      renterConfirmed,
      events: extReq.events.map((e) => ({ id: e.id, type: e.type, detail: e.detail, createdAt: e.createdAt })),
    };
  }
}

function toDateOnlyIso(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timezone).toFormat('yyyy-LL-dd');
}

function toHHmm(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timezone).toFormat('HH:mm');
}

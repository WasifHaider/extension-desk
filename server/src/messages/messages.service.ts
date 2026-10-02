import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma.service';
import { settings } from '../config/settings';
import { createLlmProvider } from '../llm/providers';
import { interpretRequest } from '../llm/interpretRequest';
import { ParseInput } from '../llm/types';
import { InboundMessageDto } from './dto';
import { evaluateExtension } from '../extensions/engine/evaluateExtension';
import { toEngineBooking, toEngineVehicle } from '../extensions/prismaMappers';
import { conflictFoundDetail, alternateCarFoundDetail } from '../extension-requests/eventCopy';
import { Evaluation } from '../extensions/engine/types';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForRenter(renterId: string) {
    if (!renterId) {
      throw new BadRequestException('renterId is required');
    }
    return this.prisma.message.findMany({ where: { renterId }, orderBy: { createdAt: 'asc' } });
  }

  async receiveInbound(dto: InboundMessageDto) {
    if (!dto.renterId || !dto.body) {
      throw new BadRequestException('renterId and body are required');
    }

    const renter = await this.prisma.renter.findUnique({ where: { id: dto.renterId } });
    if (!renter) {
      throw new NotFoundException('Renter not found');
    }

    const booking = await this.prisma.booking.findFirst({
      where: { renterId: dto.renterId, status: 'ACTIVE' },
      include: { vehicle: true },
    });
    if (!booking) {
      throw new NotFoundException("Renter has no ACTIVE booking");
    }

    const message = await this.prisma.message.create({
      data: {
        renterId: dto.renterId,
        bookingId: booking.id,
        direction: 'IN',
        body: dto.body,
        status: 'RECEIVED',
      },
    });

    await this.prisma.event.create({
      data: { bookingId: booking.id, type: 'MESSAGE_RECEIVED', detail: 'Request received' },
    });

    const now = DateTime.now().setZone(settings.timezone);
    const currentEndLocal = DateTime.fromJSDate(booking.endAt, { zone: 'utc' }).setZone(
      settings.timezone,
    );
    const parseInput: ParseInput = {
      message: dto.body,
      vehicleName: booking.vehicle.name,
      currentEndAtLocalIso: currentEndLocal.toISO() ?? '',
      currentEndAtWeekday: currentEndLocal.toFormat('cccc'),
      nowLocalIso: now.toISO() ?? '',
      nowWeekday: now.toFormat('cccc'),
      timezone: settings.timezone,
    };

    const provider = createLlmProvider();
    const { rawParse, result } = await interpretRequest(provider, parseInput, {
      currentEndAt: booking.endAt,
      timezone: settings.timezone,
      maxExtensionDays: settings.maxExtensionDays,
      vagueTimeDefaults: settings.vagueTimeDefaults,
    });

    const intent = rawParse?.intent ?? 'OTHER';
    let status: string;
    let interpretedEndAt: Date | null = null;
    let interpretationNote: string | null = null;
    let optionsJson: string | null = null;
    let evaluation: Evaluation | null = null;
    let allVehiclesForEvents: Awaited<ReturnType<typeof this.prisma.vehicle.findMany>> = [];

    if (result.status === 'NOT_EXTENSION') {
      status = 'NOT_EXTENSION';
    } else if (result.status === 'NEEDS_DATE') {
      status = 'NEEDS_DATE';
      interpretationNote = result.interpretationNote;
    } else {
      status = 'READY';
      interpretedEndAt = result.interpretedEndAt;
      interpretationNote = result.interpretationNote;

      const [allBookings, allVehicles] = await Promise.all([
        this.prisma.booking.findMany({ include: { renter: true } }),
        this.prisma.vehicle.findMany(),
      ]);
      allVehiclesForEvents = allVehicles;
      evaluation = evaluateExtension({
        booking: toEngineBooking(booking),
        requestedEndAt: interpretedEndAt,
        bookings: allBookings.map(toEngineBooking),
        vehicles: allVehicles.map(toEngineVehicle),
        settings: {
          turnaroundBufferMinutes: settings.turnaroundBufferMinutes,
          longTripTiers: [...settings.longTripTiers],
          timezone: settings.timezone,
        },
      });
      optionsJson = JSON.stringify(evaluation);
    }

    const extensionRequest = await this.prisma.extensionRequest.create({
      data: {
        bookingId: booking.id,
        messageId: message.id,
        rawText: dto.body,
        intent,
        parsedJson: rawParse ? JSON.stringify(rawParse) : null,
        originalEndAt: booking.endAt,
        interpretedEndAt,
        interpretationNote,
        status,
        optionsJson,
      },
    });

    await this.prisma.event.create({
      data: {
        extensionRequestId: extensionRequest.id,
        bookingId: booking.id,
        type: 'PARSED',
        detail: interpretationNote ?? status,
      },
    });

    if (evaluation && evaluation.conflicts.length > 0) {
      await this.prisma.event.create({
        data: {
          extensionRequestId: extensionRequest.id,
          bookingId: booking.id,
          type: 'CONFLICT_FOUND',
          detail: conflictFoundDetail(evaluation.conflicts[0], settings.timezone),
        },
      });
      const reassign = evaluation.options.find((o) => o.type === 'REASSIGN_NEXT');
      if (reassign?.reassign) {
        const toVehicle = allVehiclesForEvents.find((v) => v.id === reassign.reassign!.toVehicleId);
        if (toVehicle) {
          await this.prisma.event.create({
            data: {
              extensionRequestId: extensionRequest.id,
              bookingId: booking.id,
              type: 'ALTERNATE_CAR_FOUND',
              detail: alternateCarFoundDetail(toVehicle.name),
            },
          });
        }
      }
    }

    return extensionRequest;
  }
}

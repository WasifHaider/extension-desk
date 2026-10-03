import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePlaygroundBookingDto, UpdatePlaygroundBookingDto } from './dto';
import { seedPlayground } from './seed';

const SCOPE = 'PLAYGROUND';
const COVERAGE_DAILY_CENTS = 1500;

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

@Injectable()
export class PlaygroundService {
  constructor(private readonly prisma: PrismaService) {}

  async reset() {
    await seedPlayground(this.prisma);
    return { ok: true as const };
  }

  async listBookings() {
    return this.prisma.booking.findMany({
      where: { vehicle: { scope: SCOPE } },
      include: { vehicle: true, renter: true },
      orderBy: { startAt: 'asc' },
    });
  }

  private async assertNoOverlap(
    vehicleId: string,
    startAt: Date,
    endAt: Date,
    excludeBookingId?: string,
  ) {
    const blocking = await this.prisma.booking.findMany({
      where: {
        vehicleId,
        status: { in: ['CONFIRMED', 'ACTIVE'] },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
    });
    const conflict = blocking.some((b) =>
      overlaps(startAt.getTime(), endAt.getTime(), b.startAt.getTime(), b.endAt.getTime()),
    );
    if (conflict) {
      throw new ConflictException('Overlaps another blocking booking on this vehicle');
    }
  }

  private async resolveRenterId(name: string | null): Promise<string | null> {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    const existing = await this.prisma.renter.findFirst({ where: { scope: SCOPE, name: trimmed } });
    if (existing) return existing.id;
    const created = await this.prisma.renter.create({
      data: { name: trimmed, phone: '555-0100', scope: SCOPE },
    });
    return created.id;
  }

  async createBooking(dto: CreatePlaygroundBookingDto) {
    if (!dto.vehicleId || !dto.source || !dto.startAt || !dto.endAt) {
      throw new BadRequestException('vehicleId, source, startAt and endAt are required');
    }
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle || vehicle.scope !== SCOPE) {
      throw new NotFoundException('Vehicle not found in playground');
    }
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (!(startAt < endAt)) {
      throw new BadRequestException('startAt must be before endAt');
    }
    await this.assertNoOverlap(dto.vehicleId, startAt, endAt);

    const renterId = dto.source === 'TURO' ? null : await this.resolveRenterId(dto.renterName);
    const booking = await this.prisma.booking.create({
      data: {
        vehicleId: dto.vehicleId,
        renterId,
        source: dto.source,
        status: 'CONFIRMED',
        startAt,
        endAt,
        dailyRateCents: vehicle.dailyRateCents,
        coverageDailyCents: dto.hasCover ? COVERAGE_DAILY_CENTS : 0,
        coverageEndsAt: dto.hasCover ? endAt : null,
      },
    });
    await this.prisma.event.create({
      data: { bookingId: booking.id, type: 'BOOKING_CREATED', detail: 'Booking created' },
    });
    return booking;
  }

  async updateBooking(id: string, dto: UpdatePlaygroundBookingDto) {
    const existing = await this.prisma.booking.findUnique({ where: { id }, include: { vehicle: true } });
    if (!existing || existing.vehicle.scope !== SCOPE) {
      throw new NotFoundException('Booking not found in playground');
    }
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle || vehicle.scope !== SCOPE) {
      throw new NotFoundException('Vehicle not found in playground');
    }
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (!(startAt < endAt)) {
      throw new BadRequestException('startAt must be before endAt');
    }
    await this.assertNoOverlap(dto.vehicleId, startAt, endAt, id);

    const renterId = dto.source === 'TURO' ? null : await this.resolveRenterId(dto.renterName);
    const booking = await this.prisma.booking.update({
      where: { id },
      data: {
        vehicleId: dto.vehicleId,
        renterId,
        source: dto.source,
        startAt,
        endAt,
        dailyRateCents: vehicle.dailyRateCents,
        coverageDailyCents: dto.hasCover ? COVERAGE_DAILY_CENTS : 0,
        coverageEndsAt: dto.hasCover ? endAt : null,
      },
    });
    await this.prisma.event.create({
      data: { bookingId: booking.id, type: 'BOOKING_UPDATED', detail: 'Booking updated' },
    });
    return booking;
  }

  async cancelBooking(id: string) {
    const existing = await this.prisma.booking.findUnique({ where: { id }, include: { vehicle: true } });
    if (!existing || existing.vehicle.scope !== SCOPE) {
      throw new NotFoundException('Booking not found in playground');
    }
    const booking = await this.prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.prisma.event.create({
      data: { bookingId: booking.id, type: 'BOOKING_CANCELLED', detail: 'Booking cancelled' },
    });
    return booking;
  }
}

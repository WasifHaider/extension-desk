import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('api/bookings')
export class BookingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Query('from') from?: string, @Query('to') to?: string, @Query('scope') scope?: string) {
    const where = {
      vehicle: { scope: scope ?? 'DEMO' },
      ...(from && to ? { startAt: { lt: new Date(to) }, endAt: { gt: new Date(from) } } : {}),
    };
    return this.prisma.booking.findMany({
      where,
      include: { vehicle: true, renter: true },
      orderBy: { startAt: 'asc' },
    });
  }
}

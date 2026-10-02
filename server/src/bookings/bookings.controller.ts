import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('api/bookings')
export class BookingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.booking.findMany({
      include: { vehicle: true, renter: true },
      orderBy: { startAt: 'asc' },
    });
  }
}

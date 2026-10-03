import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('api/renters')
export class RentersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findActive(@Query('scope') scope?: string) {
    const renters = await this.prisma.renter.findMany({
      where: { scope: scope ?? 'DEMO', bookings: { some: { status: 'ACTIVE' } } },
      include: { bookings: { where: { status: 'ACTIVE' }, include: { vehicle: true }, take: 1 } },
      orderBy: { name: 'asc' },
    });
    return renters.map((r) => ({
      id: r.id,
      name: r.name,
      vehicleName: r.bookings[0]?.vehicle.name ?? null,
      bookingId: r.bookings[0]?.id ?? null,
    }));
  }
}

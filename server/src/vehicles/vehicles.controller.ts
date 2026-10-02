import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('api/vehicles')
export class VehiclesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.vehicle.findMany({ orderBy: { name: 'asc' } });
  }
}

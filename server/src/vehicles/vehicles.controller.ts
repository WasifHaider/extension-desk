import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('api/vehicles')
export class VehiclesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Query('scope') scope?: string) {
    return this.prisma.vehicle.findMany({ where: { scope: scope ?? 'DEMO' }, orderBy: { name: 'asc' } });
  }
}

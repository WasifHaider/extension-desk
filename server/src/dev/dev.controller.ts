import { Controller, Post } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { seed } from './seed';

@Controller('api/dev')
export class DevController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('reset')
  async reset() {
    await seed(this.prisma);
    return { ok: true as const };
  }
}

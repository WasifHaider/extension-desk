import { Module } from '@nestjs/common';
import { PlaygroundController } from './playground.controller';
import { PlaygroundService } from './playground.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PlaygroundController],
  providers: [PlaygroundService, PrismaService],
})
export class PlaygroundModule {}

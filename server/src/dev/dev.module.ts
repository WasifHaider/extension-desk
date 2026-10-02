import { Module } from '@nestjs/common';
import { DevController } from './dev.controller';
import { PrismaService } from '../prisma.service';

@Module({ controllers: [DevController], providers: [PrismaService] })
export class DevModule {}

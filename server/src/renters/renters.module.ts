import { Module } from '@nestjs/common';
import { RentersController } from './renters.controller';
import { PrismaService } from '../prisma.service';

@Module({ controllers: [RentersController], providers: [PrismaService] })
export class RentersModule {}

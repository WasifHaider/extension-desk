import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { BookingsController } from './bookings/bookings.controller';

@Module({
  controllers: [BookingsController],
  providers: [PrismaService],
})
export class AppModule {}

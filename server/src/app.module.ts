import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { BookingsController } from './bookings/bookings.controller';
import { MessagesModule } from './messages/messages.module';
import { ExtensionRequestsModule } from './extension-requests/extension-requests.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { RentersModule } from './renters/renters.module';
import { MetaModule } from './meta/meta.module';
import { DevModule } from './dev/dev.module';

@Module({
  imports: [MessagesModule, ExtensionRequestsModule, VehiclesModule, RentersModule, MetaModule, DevModule],
  controllers: [BookingsController],
  providers: [PrismaService],
})
export class AppModule {}

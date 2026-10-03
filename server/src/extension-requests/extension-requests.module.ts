import { Module } from '@nestjs/common';
import { ExtensionRequestsController } from './extension-requests.controller';
import { ExtensionRequestsService } from './extension-requests.service';
import { PrismaService } from '../prisma.service';
import { PAYMENT_PROVIDER } from './payment-provider.token';
import { MockPaymentProvider } from '../payments/paymentProvider';

@Module({
  controllers: [ExtensionRequestsController],
  providers: [
    ExtensionRequestsService,
    PrismaService,
    { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider },
  ],
})
export class ExtensionRequestsModule {}

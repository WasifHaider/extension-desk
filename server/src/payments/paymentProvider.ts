import { randomUUID } from 'crypto';

export interface ChargeParams {
  bookingId: string;
  amountCents: number;
}

export interface ChargeResult {
  providerRef: string;
}

export interface PaymentProvider {
  charge(params: ChargeParams): Promise<ChargeResult>;
}

export class MockPaymentProvider implements PaymentProvider {
  async charge(_params: ChargeParams): Promise<ChargeResult> {
    return { providerRef: `mock_ch_${randomUUID().replace(/-/g, '')}` };
  }
}

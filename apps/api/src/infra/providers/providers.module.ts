import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/config.module';
import { MockPaymentProvider } from './payments/mock-payment.provider';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payments/payment.provider';
import { MockPayoutProvider, PAYOUT_PROVIDER, type PayoutProvider } from './payouts/payout.provider';
import { MockShippingProvider, SHIPPING_PROVIDER, type ShippingProvider } from './shipping/shipping.provider';

/**
 * Provider registry. Adding a real gateway = implement the interface + add a case here.
 * Only mock adapters ship in the repository because real ones require vendor credentials.
 */
@Global()
@Module({
  providers: [
    { provide: PAYMENT_PROVIDER, useFactory: (env: Env): PaymentProvider => new MockPaymentProvider(env.PAYMENT_WEBHOOK_SECRET), inject: [ENV] },
    { provide: SHIPPING_PROVIDER, useFactory: (): ShippingProvider => new MockShippingProvider() },
    { provide: PAYOUT_PROVIDER, useFactory: (): PayoutProvider => new MockPayoutProvider() },
  ],
  exports: [PAYMENT_PROVIDER, SHIPPING_PROVIDER, PAYOUT_PROVIDER],
})
export class ProvidersModule {}

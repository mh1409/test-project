import type { PaymentMethodType } from '@souq/types';

export type ProviderIntentStatus = 'requires_payment_method' | 'requires_action' | 'processing' | 'authorized' | 'captured' | 'failed' | 'cancelled';

export interface CreateIntentInput {
  amount: number; // minor units
  currency: string;
  methodType: PaymentMethodType;
  orderId: string;
  customerEmail?: string | null;
  idempotencyKey: string;
  savedMethodToken?: string | null;
  metadata?: Record<string, string>;
}

export interface ProviderIntent {
  providerIntentId: string;
  status: ProviderIntentStatus;
  clientSecret?: string;
  nextAction?: { type: 'redirect' | '3ds' | 'bank_transfer_instructions'; url?: string; details?: Record<string, unknown> };
  feeAmount?: number;
  failureCode?: string;
  failureMessage?: string;
}

export interface ProviderRefund {
  providerRefundId: string;
  status: 'pending' | 'succeeded' | 'failed';
  failureMessage?: string;
}

export interface WebhookEventParsed {
  eventId: string;
  type: 'payment.authorized' | 'payment.captured' | 'payment.failed' | 'payment.cancelled' | 'refund.succeeded' | 'refund.failed' | 'unknown';
  providerIntentId?: string;
  providerRefundId?: string;
  amount?: number;
  failureCode?: string;
  failureMessage?: string;
  occurredAt: Date;
  raw: unknown;
}

/**
 * Payment provider port. Real gateways (e.g. HyperPay, Moyasar, Tap, Stripe, Checkout.com)
 * implement this interface; the domain never talks to a vendor SDK directly.
 */
export interface PaymentProvider {
  readonly name: string;
  createIntent(input: CreateIntentInput): Promise<ProviderIntent>;
  /** Confirm/authorize with a client-side token (card token, wallet payload). */
  confirm(providerIntentId: string, paymentToken?: string): Promise<ProviderIntent>;
  capture(providerIntentId: string, amount?: number): Promise<ProviderIntent>;
  cancel(providerIntentId: string): Promise<ProviderIntent>;
  refund(providerIntentId: string, amount: number, idempotencyKey: string, reason?: string): Promise<ProviderRefund>;
  getIntent(providerIntentId: string): Promise<ProviderIntent>;
  /** Verify HMAC signature + timestamp tolerance; return parsed event or throw. */
  verifyAndParseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): WebhookEventParsed;
  /** Tokenize a saved method (mock only). */
  tokenizeMethod?(input: { methodType: PaymentMethodType; last4: string; brand?: string; expMonth?: number; expYear?: number }): Promise<{ token: string }>;
  supports(methodType: PaymentMethodType): boolean;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

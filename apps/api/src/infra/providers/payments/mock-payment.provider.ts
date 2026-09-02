import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { AppError } from '@souq/shared';
import type { PaymentMethodType } from '@souq/types';
import type { CreateIntentInput, PaymentProvider, ProviderIntent, ProviderRefund, WebhookEventParsed } from './payment.provider';

interface StoredIntent extends ProviderIntent {
  amount: number;
  currency: string;
  methodType: PaymentMethodType;
  captured: number;
  refunded: number;
  refundsByKey: Map<string, ProviderRefund>;
}

/**
 * Deterministic in-memory gateway for development and tests.
 * Test tokens: "tok_success" (default), "tok_fail", "tok_3ds" (requires action then succeeds on next confirm),
 * "tok_insufficient" (declined). Bank transfer intents stay "requires_action" until a webhook marks them captured.
 * Webhooks are signed HMAC-SHA256 over `${timestamp}.${body}` in header `x-souq-signature: t=..,v1=..`.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  private readonly intents = new Map<string, StoredIntent>();
  private readonly byIdempotency = new Map<string, string>();

  constructor(private readonly webhookSecret: string, private readonly toleranceSeconds = 300) {}

  supports(methodType: PaymentMethodType): boolean {
    return methodType !== 'WALLET';
  }

  async createIntent(input: CreateIntentInput): Promise<ProviderIntent> {
    const existing = this.byIdempotency.get(input.idempotencyKey);
    if (existing) return this.public(this.intents.get(existing)!);
    const id = `pi_mock_${randomUUID().replace(/-/g, '')}`;
    const isCod = input.methodType === 'CASH_ON_DELIVERY';
    const intent: StoredIntent = {
      providerIntentId: id,
      status: isCod ? 'authorized' : 'requires_payment_method',
      clientSecret: `${id}_secret_${randomUUID().slice(0, 8)}`,
      amount: input.amount,
      currency: input.currency,
      methodType: input.methodType,
      captured: 0,
      refunded: 0,
      refundsByKey: new Map(),
      feeAmount: isCod ? 0 : Math.round(input.amount * 0.025) + 100,
    };
    if (input.methodType === 'BANK_TRANSFER') {
      intent.status = 'requires_action';
      intent.nextAction = { type: 'bank_transfer_instructions', details: { iban: 'SA0380000000608010167519', reference: id.slice(-8).toUpperCase(), amount: input.amount } };
    }
    if (input.savedMethodToken) intent.status = 'requires_action';
    this.intents.set(id, intent);
    this.byIdempotency.set(input.idempotencyKey, id);
    return this.public(intent);
  }

  async confirm(providerIntentId: string, paymentToken = 'tok_success'): Promise<ProviderIntent> {
    const intent = this.require(providerIntentId);
    if (intent.status === 'captured' || intent.status === 'authorized') return this.public(intent);
    if (intent.status === 'failed' || intent.status === 'cancelled') return this.public(intent);
    if (intent.methodType === 'BANK_TRANSFER') return this.public(intent); // awaits webhook
    switch (paymentToken) {
      case 'tok_fail':
        intent.status = 'failed';
        intent.failureCode = 'card_declined';
        intent.failureMessage = 'The card was declined';
        break;
      case 'tok_insufficient':
        intent.status = 'failed';
        intent.failureCode = 'insufficient_funds';
        intent.failureMessage = 'Insufficient funds';
        break;
      case 'tok_3ds':
        if (intent.status === 'requires_action') {
          intent.status = 'captured';
          intent.captured = intent.amount;
        } else {
          intent.status = 'requires_action';
          intent.nextAction = { type: '3ds', url: `https://3ds.mock.local/challenge/${providerIntentId}` };
        }
        break;
      default:
        intent.status = 'captured';
        intent.captured = intent.amount;
    }
    return this.public(intent);
  }

  async capture(providerIntentId: string, amount?: number): Promise<ProviderIntent> {
    const intent = this.require(providerIntentId);
    if (intent.status !== 'authorized' && intent.status !== 'captured') throw new AppError('PAYMENT_FAILED', 'Intent cannot be captured in its current state');
    intent.captured = Math.min(intent.amount, amount ?? intent.amount);
    intent.status = 'captured';
    return this.public(intent);
  }

  async cancel(providerIntentId: string): Promise<ProviderIntent> {
    const intent = this.require(providerIntentId);
    if (intent.status === 'captured') throw new AppError('PAYMENT_FAILED', 'Captured intents must be refunded, not cancelled');
    intent.status = 'cancelled';
    return this.public(intent);
  }

  async refund(providerIntentId: string, amount: number, idempotencyKey: string): Promise<ProviderRefund> {
    const intent = this.require(providerIntentId);
    const existing = intent.refundsByKey.get(idempotencyKey);
    if (existing) return existing;
    if (intent.status !== 'captured' && intent.status !== 'authorized') {
      return { providerRefundId: `re_mock_${randomUUID().slice(0, 12)}`, status: 'failed', failureMessage: 'Payment not captured' };
    }
    if (intent.refunded + amount > intent.captured) {
      return { providerRefundId: `re_mock_${randomUUID().slice(0, 12)}`, status: 'failed', failureMessage: 'Refund exceeds captured amount' };
    }
    intent.refunded += amount;
    const refund: ProviderRefund = { providerRefundId: `re_mock_${randomUUID().slice(0, 12)}`, status: 'succeeded' };
    intent.refundsByKey.set(idempotencyKey, refund);
    return refund;
  }

  async getIntent(providerIntentId: string): Promise<ProviderIntent> {
    return this.public(this.require(providerIntentId));
  }

  /** Test helper: create a signed webhook payload the way the real gateway would. */
  signWebhook(payload: object, timestamp = Math.floor(Date.now() / 1000)): { body: string; headers: Record<string, string> } {
    const body = JSON.stringify(payload);
    const sig = createHmac('sha256', this.webhookSecret).update(`${timestamp}.${body}`).digest('hex');
    return { body, headers: { 'x-souq-signature': `t=${timestamp},v1=${sig}`, 'content-type': 'application/json' } };
  }

  verifyAndParseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): WebhookEventParsed {
    const header = headers['x-souq-signature'];
    const sigHeader = Array.isArray(header) ? header[0] : header;
    if (!sigHeader) throw new AppError('FORBIDDEN', 'Missing webhook signature');
    const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('=') as [string, string]));
    const t = Number(parts.t);
    const v1 = parts.v1 ?? '';
    if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > this.toleranceSeconds) throw new AppError('FORBIDDEN', 'Webhook timestamp outside tolerance');
    const expected = createHmac('sha256', this.webhookSecret).update(`${t}.${rawBody.toString('utf8')}`).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(v1);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError('FORBIDDEN', 'Invalid webhook signature');
    const payload = JSON.parse(rawBody.toString('utf8')) as { id: string; type: string; data: Record<string, unknown>; created?: number };
    const data = payload.data ?? {};
    const type = ([
      'payment.authorized',
      'payment.captured',
      'payment.failed',
      'payment.cancelled',
      'refund.succeeded',
      'refund.failed',
    ].includes(payload.type)
      ? payload.type
      : 'unknown') as WebhookEventParsed['type'];
    // Reflect state into the in-memory store so subsequent getIntent calls agree with the webhook.
    const intentId = typeof data.intentId === 'string' ? data.intentId : undefined;
    if (intentId && this.intents.has(intentId)) {
      const intent = this.intents.get(intentId)!;
      if (type === 'payment.captured') {
        intent.status = 'captured';
        intent.captured = intent.amount;
      } else if (type === 'payment.failed') intent.status = 'failed';
      else if (type === 'payment.authorized') intent.status = 'authorized';
    }
    return {
      eventId: payload.id,
      type,
      providerIntentId: intentId,
      providerRefundId: typeof data.refundId === 'string' ? data.refundId : undefined,
      amount: typeof data.amount === 'number' ? data.amount : undefined,
      failureCode: typeof data.failureCode === 'string' ? data.failureCode : undefined,
      failureMessage: typeof data.failureMessage === 'string' ? data.failureMessage : undefined,
      occurredAt: payload.created ? new Date(payload.created * 1000) : new Date(),
      raw: payload,
    };
  }

  async tokenizeMethod(input: { methodType: PaymentMethodType; last4: string; brand?: string }): Promise<{ token: string }> {
    return { token: `pm_mock_${input.methodType.toLowerCase()}_${input.last4}_${randomUUID().slice(0, 8)}` };
  }

  private require(id: string): StoredIntent {
    const intent = this.intents.get(id);
    if (!intent) throw new AppError('NOT_FOUND', `Payment intent ${id} not found at provider`);
    return intent;
  }

  private public(i: StoredIntent): ProviderIntent {
    return { providerIntentId: i.providerIntentId, status: i.status, clientSecret: i.clientSecret, nextAction: i.nextAction, feeAmount: i.feeAmount, failureCode: i.failureCode, failureMessage: i.failureMessage };
  }
}

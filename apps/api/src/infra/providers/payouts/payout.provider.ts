import { randomUUID } from 'node:crypto';

export interface PayoutRequest {
  payoutId: string;
  amount: number;
  currency: string;
  accountToken: string;
  idempotencyKey: string;
  description: string;
}
export interface PayoutResult {
  providerPayoutId: string;
  status: 'processing' | 'paid' | 'failed';
  failureReason?: string;
  feeAmount: number;
}
export interface PayoutProvider {
  readonly name: string;
  /** Tokenize bank details; the platform never stores raw IBANs. */
  tokenizeAccount(iban: string, holder: string): Promise<{ token: string; last4: string }>;
  send(request: PayoutRequest): Promise<PayoutResult>;
  status(providerPayoutId: string): Promise<PayoutResult>;
}
export const PAYOUT_PROVIDER = Symbol('PAYOUT_PROVIDER');

export class MockPayoutProvider implements PayoutProvider {
  readonly name = 'mock';
  private readonly sent = new Map<string, PayoutResult>();
  private readonly byKey = new Map<string, PayoutResult>();

  async tokenizeAccount(iban: string): Promise<{ token: string; last4: string }> {
    return { token: `ba_mock_${randomUUID().replace(/-/g, '').slice(0, 20)}`, last4: iban.slice(-4) };
  }

  async send(request: PayoutRequest): Promise<PayoutResult> {
    const existing = this.byKey.get(request.idempotencyKey);
    if (existing) return existing;
    // Accounts whose token ends with "fail" simulate bank rejection.
    const failed = request.accountToken.endsWith('fail');
    const result: PayoutResult = {
      providerPayoutId: `po_mock_${randomUUID().slice(0, 12)}`,
      status: failed ? 'failed' : 'paid',
      failureReason: failed ? 'Beneficiary account closed' : undefined,
      feeAmount: failed ? 0 : 500,
    };
    this.sent.set(result.providerPayoutId, result);
    this.byKey.set(request.idempotencyKey, result);
    return result;
  }

  async status(providerPayoutId: string): Promise<PayoutResult> {
    const r = this.sent.get(providerPayoutId);
    if (!r) return { providerPayoutId, status: 'failed', failureReason: 'Unknown payout', feeAmount: 0 };
    return r;
  }
}

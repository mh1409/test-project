/**
 * Cross-module contracts (ports). Modules depend on these tokens/interfaces instead of each
 * other's concrete services, keeping domain boundaries explicit and cycle-free.
 * Implementing module: provide `{ provide: TOKEN, useExisting: ConcreteService }` and export it.
 */
import type { Tx } from '../../infra/prisma/prisma.service';

// ── Inventory ───────────────────────────────────────────────────────────────
export interface ReserveLine {
  variantId: string;
  quantity: number;
}
export interface InventoryPort {
  /** Atomically reserve stock for all lines or throw InsufficientStockError. Must be called inside `tx`. */
  reserve(tx: Tx, lines: ReserveLine[], ref: { checkoutSessionId: string; expiresAt: Date }): Promise<{ reservationIds: string[] }>;
  /** Convert reservations of a checkout session into sold units (order paid). */
  commit(tx: Tx, checkoutSessionId: string, orderId: string): Promise<void>;
  /** Release active reservations of a checkout session (expired/cancelled/failed payment). */
  release(tx: Tx, checkoutSessionId: string, reason: string): Promise<void>;
  /** Return sold units to stock (approved return / cancellation after payment). */
  restock(tx: Tx, lines: ReserveLine[], ref: { type: string; id: string }, actorId?: string): Promise<void>;
  /** Available = onHand - reserved for a set of variants. */
  availability(variantIds: string[]): Promise<Record<string, number>>;
}
export const INVENTORY_PORT = Symbol('INVENTORY_PORT');

// ── Promotions (coupons / flash deals) ──────────────────────────────────────
export interface CouponContext {
  userId?: string | null;
  currency: string;
  items: { productId: string; variantId: string; sellerId: string; categoryId: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  isFirstOrder: boolean;
}
export interface CouponEvaluation {
  couponId: string;
  code: string;
  type: 'FIXED' | 'PERCENTAGE' | 'FREE_SHIPPING';
  sellerId: string | null;
  /** total discount in minor units (0 for FREE_SHIPPING) */
  discountAmount: number;
  freeShipping: boolean;
  /** discount allocated per item (sum == discountAmount) */
  itemDiscounts: Record<string, number>; // key = variantId
}
export interface PromotionsPort {
  /** Validate and evaluate a coupon against a cart context. Throws AppError('COUPON_INVALID'). */
  evaluateCoupon(code: string, ctx: CouponContext): Promise<CouponEvaluation>;
  /** Record a redemption within the checkout transaction (increments usedCount; enforces limits with row lock). */
  redeem(tx: Tx, couponId: string, orderId: string, userId: string | null, amount: number): Promise<void>;
  /** Active flash deal price for variants (variantId -> dealPrice) */
  activeDealPrices(variantIds: string[]): Promise<Record<string, { dealPrice: number; dealItemId: string }>>;
  /** Consume flash deal quantity inside checkout tx (throws if limit exceeded). */
  consumeDeal(tx: Tx, dealItemId: string, quantity: number, userId: string | null): Promise<void>;
}
export const PROMOTIONS_PORT = Symbol('PROMOTIONS_PORT');

// ── Refunds (implemented by payments module) ────────────────────────────────
export interface CreateRefundInput {
  orderId: string;
  sellerOrderId?: string | null;
  amount: number;
  shippingRefund?: number;
  reason: string;
  items?: { orderItemId: string; quantity: number; amount: number }[];
  returnRequestId?: string | null;
  disputeId?: string | null;
  initiatedBy?: string | null;
  idempotencyKey: string;
}
export interface RefundsPort {
  /** Creates + processes a refund via the payment provider, posts ledger entries, updates order totals/status. Idempotent by key. */
  createRefund(input: CreateRefundInput): Promise<{ refundId: string; status: string }>;
}
export const REFUNDS_PORT = Symbol('REFUNDS_PORT');

// ── Tax (implemented by finance module) ─────────────────────────────────────
export interface TaxLineInput {
  key: string; // variantId
  amount: number; // taxable amount (inclusive price * qty - discounts)
  productType: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
}
export interface TaxResult {
  rateBps: number;
  inclusive: boolean;
  jurisdiction: string;
  lines: Record<string, { taxAmount: number; rateBps: number }>;
  total: number;
  snapshot: Record<string, unknown>;
}
export interface TaxPort {
  calculate(input: { country: string; region?: string | null; lines: TaxLineInput[]; shippingAmount: number }): Promise<TaxResult>;
}
export const TAX_PORT = Symbol('TAX_PORT');

// ── Commission (implemented by finance module) ───────────────────────────────
export interface CommissionPort {
  /** Resolve commission bps for a sale line with priority: product > category > seller > campaign > default. */
  resolveBps(input: { sellerId: string; categoryId: string; productId: string; at?: Date }): Promise<{ bps: number; ruleId: string | null; source: string }>;
}
export const COMMISSION_PORT = Symbol('COMMISSION_PORT');

// ── Shipping rates (implemented by shipping module) ──────────────────────────
export interface ShippingOption {
  ruleId: string;
  name: string;
  nameAr: string | null;
  provider: string;
  serviceCode: string;
  amount: number;
  currency: string;
  minDays: number;
  maxDays: number;
}
export interface ShippingRatesPort {
  optionsForSeller(input: { sellerId: string; destination: { country: string; region?: string | null; city?: string | null }; weightGrams: number; subtotal: number; productTypes: string[]; currency: string }): Promise<ShippingOption[]>;
}
export const SHIPPING_RATES_PORT = Symbol('SHIPPING_RATES_PORT');

// ── Wallet (implemented by finance module) ───────────────────────────────────
export interface WalletPort {
  /** Debit wallet inside tx; throws PAYMENT_FAILED when insufficient. Idempotent by key. */
  debit(tx: Tx, userId: string, amount: number, currency: string, ref: { type: string; id: string; idempotencyKey: string; description?: string }): Promise<void>;
  credit(tx: Tx, userId: string, amount: number, currency: string, ref: { type: string; id: string; idempotencyKey: string; description?: string }): Promise<void>;
  balance(userId: string): Promise<{ balance: number; currency: string }>;
}
export const WALLET_PORT = Symbol('WALLET_PORT');

// ── Risk (implemented by risk module) ────────────────────────────────────────
export interface RiskPort {
  assess(input: { context: 'CHECKOUT' | 'LOGIN' | 'REFUND' | 'REGISTRATION'; userId?: string | null; orderId?: string | null; amount?: number; ip?: string | null; email?: string | null }): Promise<{ score: number; level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; decision: 'ALLOW' | 'REVIEW' | 'BLOCK' }>;
}
export const RISK_PORT = Symbol('RISK_PORT');

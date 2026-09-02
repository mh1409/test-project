import { z } from 'zod';
import { FulfillmentMethod, OrderStatus, PaymentMethodType, ReturnReason } from '@souq/types';
import { addressInputSchema, emailSchema, idempotencyKeySchema, minorUnitsSchema, paginationSchema, positiveMinorUnitsSchema, quantitySchema, uuidSchema } from './common.js';

// Cart --------------------------------------------------------------------------
export const addToCartSchema = z.object({
  productId: uuidSchema,
  variantId: uuidSchema.optional(),
  quantity: quantitySchema.default(1),
});
export const updateCartItemSchema = z.object({ quantity: z.number().int().min(0).max(999) });
export const applyCouponSchema = z.object({ code: z.string().trim().min(2).max(40) });
export const cartItemSaveSchema = z.object({ savedForLater: z.boolean() });

// Checkout ----------------------------------------------------------------------
export const fulfillmentChoiceSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('SHIPPING'), shippingRuleId: uuidSchema }),
  z.object({ method: z.literal('PICKUP'), pickupLocationId: uuidSchema }),
  z.object({ method: z.literal('DIGITAL') }),
]);

export const checkoutStartSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  guestEmail: emailSchema.optional(),
});

export const checkoutUpdateSchema = z.object({
  shippingAddressId: uuidSchema.optional(),
  shippingAddress: addressInputSchema.optional(),
  billingSameAsShipping: z.boolean().default(true),
  billingAddress: addressInputSchema.optional(),
  fulfillment: z.record(uuidSchema, fulfillmentChoiceSchema).optional(), // keyed by sellerId
  paymentMethodType: z.nativeEnum(PaymentMethodType).optional(),
  savedPaymentMethodId: uuidSchema.optional(),
});
export type CheckoutUpdateInput = z.infer<typeof checkoutUpdateSchema>;

export const checkoutConfirmSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  paymentMethodType: z.nativeEnum(PaymentMethodType),
  savedPaymentMethodId: uuidSchema.optional(),
  /** Mock provider test hint: succeed | fail | requires_action */
  paymentToken: z.string().max(200).optional(),
});

// Orders ------------------------------------------------------------------------
export const orderListSchema = paginationSchema.extend({
  status: z.nativeEnum(OrderStatus).optional(),
  q: z.string().trim().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export const cancelOrderSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const sellerOrderTransitionSchema = z.object({
  status: z.enum(['CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'CANCELLED']),
  note: z.string().trim().max(500).optional(),
});
export const createShipmentSchema = z.object({
  serviceCode: z.string().trim().max(40).optional(),
  weightGrams: z.number().int().min(1).optional(),
  itemIds: z.array(uuidSchema).min(1).optional(),
});
export const shipmentEventSchema = z.object({
  status: z.enum(['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED']),
  description: z.string().trim().max(500).optional(),
  location: z.string().trim().max(200).optional(),
});
export const pickupReadySchema = z.object({ note: z.string().trim().max(500).optional() });
export const pickupCompleteSchema = z.object({ code: z.string().trim().min(6).max(12) });

// Payments ----------------------------------------------------------------------
export const createPaymentIntentSchema = z.object({
  orderId: uuidSchema,
  methodType: z.nativeEnum(PaymentMethodType),
  idempotencyKey: idempotencyKeySchema,
  savedPaymentMethodId: uuidSchema.optional(),
});
export const confirmPaymentSchema = z.object({ paymentToken: z.string().max(200).optional() });
export const refundRequestSchema = z.object({
  amount: positiveMinorUnitsSchema.optional(), // omit => full remaining
  reason: z.string().trim().min(3).max(500),
  items: z.array(z.object({ orderItemId: uuidSchema, quantity: quantitySchema })).optional(),
  refundShipping: z.boolean().default(false),
  idempotencyKey: idempotencyKeySchema,
});
export type RefundRequestInput = z.infer<typeof refundRequestSchema>;

// Returns -----------------------------------------------------------------------
export const createReturnSchema = z.object({
  sellerOrderId: uuidSchema,
  items: z.array(z.object({ orderItemId: uuidSchema, quantity: quantitySchema })).min(1).max(50),
  reason: z.nativeEnum(ReturnReason),
  description: z.string().trim().min(5).max(2000),
  images: z.array(z.string().url()).max(6).default([]),
});
export const returnDecisionSchema = z.object({
  decision: z.enum(['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RECEIVED', 'CLOSED']),
  note: z.string().trim().max(1000).optional(),
  refundAmount: minorUnitsSchema.optional(),
  refundShipping: z.boolean().optional(),
});
export const returnShipBackSchema = z.object({ trackingNumber: z.string().trim().min(3).max(64) });

// Disputes ----------------------------------------------------------------------
export const openDisputeSchema = z.object({
  sellerOrderId: uuidSchema,
  reason: z.enum(['ITEM_NOT_RECEIVED', 'NOT_AS_DESCRIBED', 'DAMAGED', 'REFUND_NOT_RECEIVED', 'BUYER_ABUSE', 'OTHER']),
  description: z.string().trim().min(10).max(4000),
  requestedAmount: minorUnitsSchema.optional(),
  attachments: z.array(z.object({ key: z.string(), name: z.string(), mime: z.string(), size: z.number().int() })).max(10).default([]),
});
export const disputeMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  attachments: z.array(z.object({ key: z.string(), name: z.string(), mime: z.string(), size: z.number().int() })).max(10).default([]),
});
export const disputeResolveSchema = z.object({
  resolution: z.enum(['RESOLVED_REFUND', 'RESOLVED_PARTIAL_REFUND', 'RESOLVED_REJECTED']),
  amount: positiveMinorUnitsSchema.optional(),
  note: z.string().trim().min(3).max(2000),
});

// Auctions ----------------------------------------------------------------------
export const placeBidSchema = z.object({ amount: positiveMinorUnitsSchema, idempotencyKey: idempotencyKeySchema.optional() });
export const autoBidSchema = z.object({ maxAmount: positiveMinorUnitsSchema });

// Wallet ------------------------------------------------------------------------
export const walletTopupSchema = z.object({ amount: positiveMinorUnitsSchema.max(1_000_000_00), idempotencyKey: idempotencyKeySchema });

// Coupons (seller / admin) ------------------------------------------------------
export const couponUpsertSchema = z
  .object({
    code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/).transform((s) => s.toUpperCase()),
    type: z.enum(['FIXED', 'PERCENTAGE', 'FREE_SHIPPING']),
    value: z.number().int().min(0),
    descriptionAr: z.string().trim().max(200).optional(),
    descriptionEn: z.string().trim().max(200).optional(),
    minCartTotal: minorUnitsSchema.optional().nullable(),
    maxDiscount: minorUnitsSchema.optional().nullable(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional().nullable(),
    usageLimit: z.number().int().positive().optional().nullable(),
    perUserLimit: z.number().int().positive().default(1),
    firstOrderOnly: z.boolean().default(false),
    categoryId: uuidSchema.optional().nullable(),
    productId: uuidSchema.optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'PERCENTAGE' && v.value > 10_000) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Percentage in bps must be <= 10000' });
    if (v.type !== 'FREE_SHIPPING' && v.value <= 0) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Value must be positive' });
    if (v.endsAt && v.endsAt <= v.startsAt) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'endsAt must be after startsAt' });
  });
export type CouponUpsertInput = z.infer<typeof couponUpsertSchema>;

export const flashDealUpsertSchema = z
  .object({
    nameAr: z.string().trim().min(2).max(100),
    nameEn: z.string().trim().min(2).max(100),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    items: z
      .array(
        z.object({
          productId: uuidSchema,
          variantId: uuidSchema.optional().nullable(),
          dealPrice: minorUnitsSchema,
          quantityLimit: z.number().int().positive().optional().nullable(),
          perUserLimit: z.number().int().positive().default(1),
        }),
      )
      .min(1)
      .max(100),
  })
  .refine((v) => v.endsAt > v.startsAt, { path: ['endsAt'], message: 'endsAt must be after startsAt' });

export const fulfillmentMethodSchema = z.nativeEnum(FulfillmentMethod);

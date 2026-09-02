import { z } from 'zod';
import { ReportTargetType } from '@souq/types';
import { paginationSchema, uuidSchema } from './common.js';

export const createProductReviewSchema = z.object({
  orderItemId: uuidSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(150).optional(),
  body: z.string().trim().min(5).max(4000),
  images: z.array(z.string().url()).max(5).default([]),
});
export const createSellerReviewSchema = z.object({
  sellerOrderId: uuidSchema,
  rating: z.number().int().min(1).max(5),
  communicationRating: z.number().int().min(1).max(5),
  shippingRating: z.number().int().min(1).max(5),
  accuracyRating: z.number().int().min(1).max(5),
  body: z.string().trim().max(2000).optional(),
});
export const reviewResponseSchema = z.object({ body: z.string().trim().min(2).max(2000) });
export const reviewListSchema = paginationSchema.extend({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(['newest', 'helpful', 'rating_desc', 'rating_asc']).default('newest'),
});

export const startConversationSchema = z.object({
  sellerId: uuidSchema.optional(),
  recipientUserId: uuidSchema.optional(),
  productId: uuidSchema.optional(),
  orderId: uuidSchema.optional(),
  body: z.string().trim().min(1).max(4000),
});
export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  clientMessageId: z.string().max(64).optional(),
  attachments: z
    .array(z.object({ uploadId: uuidSchema }))
    .max(5)
    .default([]),
});
export const messageListSchema = z.object({ cursor: z.string().max(512).optional(), limit: z.coerce.number().int().min(1).max(100).default(30) });

export const wishlistCreateSchema = z.object({ name: z.string().trim().min(1).max(60), isPublic: z.boolean().default(false) });
export const wishlistAddItemSchema = z.object({ productId: uuidSchema, note: z.string().trim().max(200).optional() });
export const savedSearchSchema = z.object({
  name: z.string().trim().min(1).max(60),
  query: z.record(z.string(), z.unknown()),
  notify: z.boolean().default(false),
});
export const priceAlertSchema = z.object({ productId: uuidSchema, targetPrice: z.number().int().min(0).optional() });
export const backInStockSchema = z.object({ productId: uuidSchema, variantId: uuidSchema.optional() });

export const createReportSchema = z.object({
  targetType: z.nativeEnum(ReportTargetType),
  targetId: uuidSchema,
  reason: z.enum(['COUNTERFEIT', 'PROHIBITED', 'MISLEADING', 'OFFENSIVE', 'SPAM', 'FRAUD', 'HARASSMENT', 'OTHER']),
  description: z.string().trim().max(2000).optional(),
  evidence: z.array(z.string().url()).max(5).default([]),
});

export const supportTicketCreateSchema = z.object({
  subject: z.string().trim().min(3).max(150),
  category: z.enum(['GENERAL', 'ORDER', 'PAYMENT', 'ACCOUNT', 'SELLER', 'TECHNICAL']).default('GENERAL'),
  orderId: uuidSchema.optional(),
  body: z.string().trim().min(5).max(6000),
  attachments: z.array(z.object({ uploadId: uuidSchema })).max(5).default([]),
});
export const supportMessageSchema = z.object({
  body: z.string().trim().min(1).max(6000),
  isInternal: z.boolean().default(false),
  attachments: z.array(z.object({ uploadId: uuidSchema })).max(5).default([]),
});
export const supportTicketUpdateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED']).optional(),
  agentId: uuidSchema.optional().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
});

export const trackEventSchema = z.object({
  name: z.enum(['page_view', 'product_view', 'search', 'search_result_click', 'add_to_cart', 'remove_from_cart', 'checkout_started', 'purchase', 'wishlist_add', 'seller_follow']),
  properties: z.record(z.string(), z.unknown()).optional(),
  anonymousId: z.string().max(64).optional(),
  sessionId: z.string().max(64).optional(),
  path: z.string().max(512).optional(),
  referrer: z.string().max(512).optional(),
});
export const trackBatchSchema = z.object({ events: z.array(trackEventSchema).min(1).max(50) });

/**
 * Domain enums mirrored from the Prisma schema. Kept as const objects so that
 * frontend code never depends on @prisma/client.
 */
const e = <T extends readonly string[]>(...values: T) =>
  Object.freeze(Object.fromEntries(values.map((v) => [v, v])) as { readonly [K in T[number]]: K });

export const UserStatus = e('ACTIVE', 'SUSPENDED', 'BANNED', 'PENDING_DELETION', 'DELETED');
export type UserStatus = keyof typeof UserStatus;

export const RoleName = e(
  'BUYER',
  'INDIVIDUAL_SELLER',
  'BUSINESS_SELLER',
  'ADMIN',
  'MODERATOR',
  'SUPPORT_AGENT',
  'FINANCE_OPERATOR',
  'CONTENT_MANAGER',
  'SUPER_ADMIN',
);
export type RoleName = keyof typeof RoleName;

export const SellerType = e('INDIVIDUAL', 'BUSINESS');
export type SellerType = keyof typeof SellerType;

export const SellerVerificationStatus = e(
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'MORE_INFORMATION_REQUIRED',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
);
export type SellerVerificationStatus = keyof typeof SellerVerificationStatus;

export const ProductStatus = e(
  'DRAFT',
  'PENDING_REVIEW',
  'ACTIVE',
  'REJECTED',
  'HIDDEN',
  'SOLD_OUT',
  'ARCHIVED',
  'SUSPENDED',
);
export type ProductStatus = keyof typeof ProductStatus;

export const ProductCondition = e('NEW', 'LIKE_NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'FOR_PARTS');
export type ProductCondition = keyof typeof ProductCondition;

export const ProductType = e('PHYSICAL', 'DIGITAL', 'SERVICE');
export type ProductType = keyof typeof ProductType;

export const ListingType = e('FIXED_PRICE', 'AUCTION');
export type ListingType = keyof typeof ListingType;

export const AttributeType = e('TEXT', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'COLOR', 'DATE', 'RANGE');
export type AttributeType = keyof typeof AttributeType;

export const MediaType = e('IMAGE', 'VIDEO', 'DOCUMENT');
export type MediaType = keyof typeof MediaType;

export const InventoryMovementType = e(
  'RECEIVE',
  'RESERVE',
  'RELEASE',
  'COMMIT',
  'RETURN',
  'DAMAGE',
  'ADJUST',
);
export type InventoryMovementType = keyof typeof InventoryMovementType;

export const OrderStatus = e(
  'PENDING_PAYMENT',
  'PAID',
  'CONFIRMED',
  'PROCESSING',
  'READY_TO_SHIP',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'DISPUTED',
);
export type OrderStatus = keyof typeof OrderStatus;

export const FulfillmentMethod = e('SHIPPING', 'PICKUP', 'DIGITAL');
export type FulfillmentMethod = keyof typeof FulfillmentMethod;

export const PaymentMethodType = e(
  'CARD',
  'MADA',
  'APPLE_PAY',
  'GOOGLE_PAY',
  'BANK_TRANSFER',
  'CASH_ON_DELIVERY',
  'WALLET',
);
export type PaymentMethodType = keyof typeof PaymentMethodType;

export const PaymentStatus = e(
  'REQUIRES_PAYMENT_METHOD',
  'REQUIRES_ACTION',
  'PROCESSING',
  'AUTHORIZED',
  'CAPTURED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'FAILED',
  'CANCELLED',
);
export type PaymentStatus = keyof typeof PaymentStatus;

export const RefundStatus = e('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
export type RefundStatus = keyof typeof RefundStatus;

export const ShipmentStatus = e(
  'PENDING',
  'LABEL_CREATED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED',
  'CANCELLED',
);
export type ShipmentStatus = keyof typeof ShipmentStatus;

export const PickupStatus = e('PENDING', 'READY', 'PICKED_UP', 'EXPIRED', 'CANCELLED');
export type PickupStatus = keyof typeof PickupStatus;

export const ReturnReason = e('DAMAGED', 'NOT_AS_DESCRIBED', 'WRONG_ITEM', 'DEFECTIVE', 'CHANGED_MIND', 'OTHER');
export type ReturnReason = keyof typeof ReturnReason;

export const ReturnStatus = e(
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'SHIPPED_BACK',
  'RECEIVED',
  'REFUND_PROCESSING',
  'REFUNDED',
  'CLOSED',
);
export type ReturnStatus = keyof typeof ReturnStatus;

export const DisputeStatus = e(
  'OPEN',
  'AWAITING_SELLER',
  'AWAITING_BUYER',
  'ESCALATED',
  'RESOLVED_REFUND',
  'RESOLVED_PARTIAL_REFUND',
  'RESOLVED_REJECTED',
  'CLOSED',
);
export type DisputeStatus = keyof typeof DisputeStatus;

export const PayoutStatus = e('PENDING', 'SCHEDULED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');
export type PayoutStatus = keyof typeof PayoutStatus;

export const LedgerAccountType = e(
  'BUYER_RECEIVABLE',
  'PLATFORM_CASH',
  'SELLER_PAYABLE',
  'PLATFORM_COMMISSION_REVENUE',
  'TAX_PAYABLE',
  'SHIPPING_REVENUE',
  'REFUND_EXPENSE',
  'PAYMENT_FEES',
  'PAYOUT_CLEARING',
  'ADJUSTMENT',
  'WALLET_LIABILITY',
);
export type LedgerAccountType = keyof typeof LedgerAccountType;

export const LedgerEntryType = e(
  'BUYER_PAYMENT',
  'SELLER_EARNING',
  'PLATFORM_COMMISSION',
  'TAX',
  'REFUND',
  'SHIPPING',
  'FEE',
  'PAYOUT',
  'ADJUSTMENT',
  'WALLET_TOPUP',
  'WALLET_SPEND',
);
export type LedgerEntryType = keyof typeof LedgerEntryType;

export const CouponType = e('FIXED', 'PERCENTAGE', 'FREE_SHIPPING');
export type CouponType = keyof typeof CouponType;

export const AuctionStatus = e('SCHEDULED', 'ACTIVE', 'ENDED', 'SOLD', 'UNSOLD', 'CANCELLED');
export type AuctionStatus = keyof typeof AuctionStatus;

export const NotificationChannel = e('IN_APP', 'EMAIL', 'SMS', 'PUSH');
export type NotificationChannel = keyof typeof NotificationChannel;

export const NotificationType = e(
  'ORDER_PAID',
  'ORDER_CONFIRMED',
  'ORDER_SHIPPED',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
  'SELLER_NEW_SALE',
  'NEW_MESSAGE',
  'RETURN_UPDATE',
  'DISPUTE_UPDATE',
  'PRICE_DROP',
  'BACK_IN_STOCK',
  'AUCTION_OUTBID',
  'AUCTION_WON',
  'AUCTION_ENDED',
  'PAYOUT_PAID',
  'SELLER_VERIFICATION',
  'PRODUCT_MODERATION',
  'ABANDONED_CART',
  'REVIEW_REPLY',
  'SUPPORT_TICKET',
  'SECURITY_ALERT',
  'SYSTEM',
);
export type NotificationType = keyof typeof NotificationType;

export const ReportTargetType = e('PRODUCT', 'SELLER', 'REVIEW', 'MESSAGE', 'USER', 'STORE', 'QUESTION');
export type ReportTargetType = keyof typeof ReportTargetType;

export const ReportStatus = e('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');
export type ReportStatus = keyof typeof ReportStatus;

export const ModerationAction = e('APPROVE', 'REJECT', 'HIDE', 'SUSPEND', 'BAN', 'RESTORE', 'WARN');
export type ModerationAction = keyof typeof ModerationAction;

export const SupportTicketStatus = e('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');
export type SupportTicketStatus = keyof typeof SupportTicketStatus;

export const WalletTransactionType = e('TOPUP', 'PURCHASE', 'REFUND', 'REWARD', 'WITHDRAWAL', 'ADJUSTMENT');
export type WalletTransactionType = keyof typeof WalletTransactionType;

export const HomeSectionType = e(
  'HERO_BANNERS',
  'FEATURED_CATEGORIES',
  'TRENDING_PRODUCTS',
  'RECOMMENDED_PRODUCTS',
  'RECENTLY_VIEWED',
  'BEST_SELLERS',
  'NEW_ARRIVALS',
  'FLASH_DEALS',
  'POPULAR_SELLERS',
  'NEAR_YOU',
  'CONTINUE_SHOPPING',
  'AUCTIONS_ENDING_SOON',
);
export type HomeSectionType = keyof typeof HomeSectionType;

export const RiskLevel = e('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
export type RiskLevel = keyof typeof RiskLevel;

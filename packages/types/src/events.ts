/**
 * Domain event catalog. Events are persisted in the transactional outbox and
 * dispatched to the message broker; consumers must be idempotent (dedupe on event id).
 */
export const DOMAIN_EVENTS = [
  'user.registered',
  'user.email_verified',
  'user.login_suspicious',
  'seller.submitted',
  'seller.approved',
  'seller.rejected',
  'seller.suspended',
  'product.published',
  'product.updated',
  'product.archived',
  'product.price_changed',
  'inventory.low',
  'inventory.back_in_stock',
  'cart.abandoned',
  'order.placed',
  'order.paid',
  'order.confirmed',
  'order.shipped',
  'order.delivered',
  'order.completed',
  'order.cancelled',
  'payment.succeeded',
  'payment.failed',
  'refund.processed',
  'return.requested',
  'return.updated',
  'dispute.opened',
  'dispute.updated',
  'dispute.resolved',
  'review.created',
  'review.replied',
  'message.sent',
  'auction.started',
  'auction.bid_placed',
  'auction.outbid',
  'auction.ended',
  'payout.scheduled',
  'payout.paid',
  'payout.failed',
  'support.ticket_created',
  'support.ticket_updated',
  'notification.requested',
] as const;

export type DomainEventName = (typeof DOMAIN_EVENTS)[number];

export interface DomainEvent<TPayload = Record<string, unknown>> {
  id: string;
  name: DomainEventName;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
  occurredAt: string;
  correlationId?: string;
  version: number;
}

/** Product analytics event taxonomy (vendor-agnostic). */
export const TRACKING_EVENTS = [
  'page_view',
  'product_view',
  'search',
  'search_result_click',
  'add_to_cart',
  'remove_from_cart',
  'checkout_started',
  'purchase',
  'wishlist_add',
  'seller_follow',
] as const;
export type TrackingEventName = (typeof TRACKING_EVENTS)[number];

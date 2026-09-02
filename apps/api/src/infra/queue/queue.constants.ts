export const QUEUES = {
  EMAIL: 'email',
  NOTIFICATIONS: 'notifications',
  MEDIA: 'media',
  SEARCH_INDEX: 'search-index',
  ANALYTICS: 'analytics',
  AUCTIONS: 'auctions',
  PAYOUTS: 'payouts',
  CLEANUP: 'cleanup',
  ORDERS: 'orders',
  SCHEDULER: 'scheduler',
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface JobPayloads {
  'email.send': { to: string; template: string; locale: 'ar' | 'en'; data: Record<string, unknown>; notificationDeliveryId?: string };
  'notification.dispatch': { notificationId: string };
  'notification.broadcast': { audience: 'ALL' | 'BUYERS' | 'SELLERS'; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; link?: string };
  'media.process': { uploadId: string };
  'search.index-product': { productId: string };
  'search.remove-product': { productId: string };
  'search.index-store': { storeId: string };
  'search.reindex-all': Record<string, never>;
  'analytics.rollup': { date: string };
  'analytics.seller-performance': Record<string, never>;
  'auction.close': { auctionId: string };
  'auction.activate': Record<string, never>;
  'payout.generate': { sellerId?: string; idempotencyKey: string };
  'payout.process': { payoutId: string };
  'cleanup.reservations': Record<string, never>;
  'cleanup.uploads': Record<string, never>;
  'cleanup.idempotency': Record<string, never>;
  'cleanup.outbox': Record<string, never>;
  'cleanup.expired-coupons': Record<string, never>;
  'cleanup.abandoned-carts': Record<string, never>;
  'cleanup.sessions': Record<string, never>;
  'flash-deals.tick': Record<string, never>;
  'orders.auto-complete': Record<string, never>;
  'orders.settlement': Record<string, never>;
  'orders.price-drop-alerts': { productId: string };
  'orders.back-in-stock': { variantId: string };
  'referral.qualify': { orderId: string };
  'data-export.generate': { requestId: string };
  'account-deletion.process': Record<string, never>;
}
export type JobName = keyof JobPayloads;

export const JOB_QUEUE: Record<JobName, QueueName> = {
  'email.send': QUEUES.EMAIL,
  'notification.dispatch': QUEUES.NOTIFICATIONS,
  'notification.broadcast': QUEUES.NOTIFICATIONS,
  'media.process': QUEUES.MEDIA,
  'search.index-product': QUEUES.SEARCH_INDEX,
  'search.remove-product': QUEUES.SEARCH_INDEX,
  'search.index-store': QUEUES.SEARCH_INDEX,
  'search.reindex-all': QUEUES.SEARCH_INDEX,
  'analytics.rollup': QUEUES.ANALYTICS,
  'analytics.seller-performance': QUEUES.ANALYTICS,
  'auction.close': QUEUES.AUCTIONS,
  'auction.activate': QUEUES.AUCTIONS,
  'payout.generate': QUEUES.PAYOUTS,
  'payout.process': QUEUES.PAYOUTS,
  'cleanup.reservations': QUEUES.CLEANUP,
  'cleanup.uploads': QUEUES.CLEANUP,
  'cleanup.idempotency': QUEUES.CLEANUP,
  'cleanup.outbox': QUEUES.CLEANUP,
  'cleanup.expired-coupons': QUEUES.CLEANUP,
  'cleanup.abandoned-carts': QUEUES.CLEANUP,
  'cleanup.sessions': QUEUES.CLEANUP,
  'flash-deals.tick': QUEUES.SCHEDULER,
  'orders.auto-complete': QUEUES.ORDERS,
  'orders.settlement': QUEUES.ORDERS,
  'orders.price-drop-alerts': QUEUES.NOTIFICATIONS,
  'orders.back-in-stock': QUEUES.NOTIFICATIONS,
  'referral.qualify': QUEUES.ORDERS,
  'data-export.generate': QUEUES.CLEANUP,
  'account-deletion.process': QUEUES.CLEANUP,
};

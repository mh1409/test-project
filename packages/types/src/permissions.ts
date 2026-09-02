/**
 * Permission catalog. Authorization is permission-based; roles are just bundles.
 * Convention: <resource>:<action>
 */
export const PERMISSIONS = [
  // catalog
  'product:create',
  'product:update',
  'product:delete',
  'product:publish',
  'product:moderate',
  'product:import',
  'category:manage',
  'brand:manage',
  'attribute:manage',
  // orders & fulfillment
  'order:view',
  'order:view:all',
  'order:manage',
  'order:refund',
  'order:cancel',
  'order:export',
  'shipment:manage',
  // returns/disputes
  'return:view',
  'return:manage',
  'dispute:view',
  'dispute:resolve',
  // sellers
  'seller:apply',
  'seller:view',
  'seller:review',
  'seller:suspend',
  'store:manage',
  // users
  'user:view',
  'user:ban',
  'user:manage',
  'user:impersonate',
  'role:manage',
  // finance
  'finance:view',
  'finance:payout',
  'finance:adjust',
  'commission:manage',
  // promotions & content
  'coupon:manage',
  'coupon:manage:own',
  'banner:manage',
  'homepage:manage',
  'cms:manage',
  // moderation and reports
  'review:moderate',
  'report:manage',
  'moderation:manage',
  // support
  'support:view',
  'support:manage',
  // analytics
  'analytics:seller',
  'analytics:admin',
  // system
  'audit:view',
  'settings:manage',
  'featureflag:manage',
  'notification:broadcast',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  BUYER: ['seller:apply', 'order:view', 'return:view', 'dispute:view'],
  INDIVIDUAL_SELLER: [
    'product:create',
    'product:update',
    'product:delete',
    'product:publish',
    'product:import',
    'order:view',
    'order:manage',
    'order:cancel',
    'order:export',
    'shipment:manage',
    'return:view',
    'return:manage',
    'dispute:view',
    'store:manage',
    'coupon:manage:own',
    'analytics:seller',
    'finance:view',
  ],
  BUSINESS_SELLER: [
    'product:create',
    'product:update',
    'product:delete',
    'product:publish',
    'product:import',
    'order:view',
    'order:manage',
    'order:cancel',
    'order:export',
    'shipment:manage',
    'return:view',
    'return:manage',
    'dispute:view',
    'store:manage',
    'coupon:manage:own',
    'analytics:seller',
    'finance:view',
  ],
  MODERATOR: ['product:moderate', 'review:moderate', 'report:manage', 'moderation:manage', 'user:view', 'seller:view', 'audit:view'],
  SUPPORT_AGENT: ['support:view', 'support:manage', 'order:view:all', 'user:view', 'return:view', 'dispute:view', 'dispute:resolve', 'seller:view'],
  FINANCE_OPERATOR: ['finance:view', 'finance:payout', 'finance:adjust', 'order:view:all', 'order:refund', 'commission:manage', 'analytics:admin', 'audit:view'],
  CONTENT_MANAGER: ['cms:manage', 'banner:manage', 'homepage:manage', 'category:manage', 'brand:manage', 'attribute:manage'],
  ADMIN: PERMISSIONS.filter((p) => p !== 'user:impersonate' && p !== 'role:manage'),
  SUPER_ADMIN: [...PERMISSIONS],
};

export const STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT_AGENT', 'FINANCE_OPERATOR', 'CONTENT_MANAGER'] as const;
export const SELLER_ROLES = ['INDIVIDUAL_SELLER', 'BUSINESS_SELLER'] as const;

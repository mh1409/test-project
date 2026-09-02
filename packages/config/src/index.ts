import { z } from 'zod';

const bool = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const csv = z.string().transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean));

/**
 * Centralized environment schema. Every service validates at startup and fails fast
 * with a readable message listing missing/invalid variables.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().default('Souq Marketplace'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_URL: z.string().url().default('http://localhost:3002'),
  API_URL: z.string().url().default('http://localhost:3001'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_GLOBAL_PREFIX: z.string().default('api'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: csv.default('http://localhost:3000,http://localhost:3002'),
  TRUST_PROXY: bool.default(false),

  // Database
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(20),

  // Redis (cache, rate limiting, queues, locks, socket adapter)
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_REQUIRED: bool.default(false),

  // Search
  SEARCH_ENGINE: z.enum(['opensearch', 'database']).default('database'),
  OPENSEARCH_URL: z.string().default('http://localhost:9200'),
  OPENSEARCH_USERNAME: z.string().optional(),
  OPENSEARCH_PASSWORD: z.string().optional(),
  SEARCH_INDEX_PREFIX: z.string().default('souq'),

  // Message broker (transactional outbox dispatch target)
  EVENT_BUS: z.enum(['memory', 'redis', 'rabbitmq']).default('redis'),
  RABBITMQ_URL: z.string().default('amqp://guest:guest@localhost:5672'),

  // Object storage (S3-compatible)
  STORAGE_DRIVER: z.enum(['s3', 'local']).default('local'),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_BUCKET_PUBLIC: z.string().default('souq-public'),
  S3_BUCKET_PRIVATE: z.string().default('souq-private'),
  S3_FORCE_PATH_STYLE: bool.default(true),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  LOCAL_STORAGE_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: bool.default(false),
  MFA_ISSUER: z.string().default('Souq'),
  PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).default(10),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),

  // Providers
  PAYMENT_PROVIDER: z.enum(['mock']).default('mock'),
  PAYMENT_WEBHOOK_SECRET: z.string().min(16).default('dev-payment-webhook-secret-change-me'),
  SHIPPING_PROVIDER: z.enum(['mock']).default('mock'),
  EMAIL_PROVIDER: z.enum(['log', 'smtp']).default('log'),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default('Souq <no-reply@souq.local>'),
  SMS_PROVIDER: z.enum(['log']).default('log'),
  PUSH_PROVIDER: z.enum(['log']).default('log'),
  PAYOUT_PROVIDER: z.enum(['mock']).default('mock'),
  VIRUS_SCANNER: z.enum(['none', 'mock']).default('mock'),

  // Marketplace business config
  DEFAULT_CURRENCY: z.string().default('SAR'),
  DEFAULT_LOCALE: z.enum(['ar', 'en']).default('ar'),
  DEFAULT_TIMEZONE: z.string().default('Asia/Riyadh'),
  DEFAULT_COMMISSION_BPS: z.coerce.number().int().min(0).max(10_000).default(1000),
  DEFAULT_VAT_BPS: z.coerce.number().int().min(0).max(10_000).default(1500),
  INVENTORY_RESERVATION_MINUTES: z.coerce.number().int().positive().default(20),
  PAYOUT_HOLD_DAYS: z.coerce.number().int().min(0).default(7),
  AUCTION_ANTI_SNIPE_SECONDS: z.coerce.number().int().min(0).default(120),
  ABANDONED_CART_HOURS: z.coerce.number().int().positive().default(3),

  // Feature flags (defaults; overridable at runtime through the admin panel)
  FEATURE_AUCTIONS: bool.default(true),
  FEATURE_DIGITAL_PRODUCTS: bool.default(true),
  FEATURE_RECOMMENDATIONS_V2: bool.default(false),
  FEATURE_GUEST_CHECKOUT: bool.default(true),
  FEATURE_WALLET: bool.default(true),
  FEATURE_REFERRALS: bool.default(false),
  FEATURE_IMPERSONATION: bool.default(false),

  // Observability
  OTEL_ENABLED: bool.default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default('souq-api'),
  METRICS_ENABLED: bool.default(true),

  // Rate limiting
  RATE_LIMIT_ENABLED: bool.default(true),

  // Web (Next.js)
  NEXT_PUBLIC_API_URL: z.string().default('http://localhost:3001'),
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
  NEXT_PUBLIC_WS_URL: z.string().default('http://localhost:3001'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env, options: { cache?: boolean } = {}): Env {
  if (cached && options.cache !== false) return cached;
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  if (result.data.NODE_ENV === 'production') {
    assertProductionSafety(result.data);
  }
  if (options.cache !== false) cached = result.data;
  return result.data;
}

export function resetEnvCache(): void {
  cached = null;
}

function assertProductionSafety(env: Env): void {
  const problems: string[] = [];
  if (env.PAYMENT_WEBHOOK_SECRET.startsWith('dev-')) problems.push('PAYMENT_WEBHOOK_SECRET uses a development default');
  if (!env.COOKIE_SECURE) problems.push('COOKIE_SECURE must be true in production');
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) problems.push('JWT secrets must differ');
  if (env.S3_SECRET_KEY === 'minioadmin' && env.STORAGE_DRIVER === 's3') problems.push('S3_SECRET_KEY uses the default credential');
  if (problems.length) {
    throw new Error(`Unsafe production configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  }
}

export const FEATURE_FLAG_KEYS = [
  'auctions',
  'digitalProducts',
  'recommendationsV2',
  'guestCheckout',
  'wallet',
  'referrals',
  'impersonation',
] as const;
export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export function featureDefaults(env: Env): Record<FeatureFlagKey, boolean> {
  return {
    auctions: env.FEATURE_AUCTIONS,
    digitalProducts: env.FEATURE_DIGITAL_PRODUCTS,
    recommendationsV2: env.FEATURE_RECOMMENDATIONS_V2,
    guestCheckout: env.FEATURE_GUEST_CHECKOUT,
    wallet: env.FEATURE_WALLET,
    referrals: env.FEATURE_REFERRALS,
    impersonation: env.FEATURE_IMPERSONATION,
  };
}

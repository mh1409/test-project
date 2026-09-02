import { faker } from '@faker-js/faker';
import type { Prisma } from '@souq/database';
import { slugify } from '@souq/shared';

/**
 * Deterministic factories for tests and seeds. Call `seedFaker(n)` first for reproducibility.
 * Factories return Prisma *input* objects; persistence is the caller's job so that
 * unit tests can use them without a database.
 */
export function seedFaker(seed = 42): void {
  faker.seed(seed);
}

let counter = 0;
export const nextId = (): number => ++counter;
export const resetCounter = (): void => {
  counter = 0;
};

export const PRECOMPUTED_PASSWORD_HASH_PLAINTEXT = 'Password123!';
/** scrypt hash of "Password123!" produced with @souq/shared hashPassword (kept static to make seeds fast). */
export const PRECOMPUTED_PASSWORD_HASH =
  'scrypt$131072$8$1$6Wn6jx6evssecsJebZIVEA$x1RSM9txW60oi5AfWlBlHeHmYEQcRdZTCqMKqUAbPRJNdFN4g_sghBxCAKtg9UrX4M4E6QzIvkbvgbTwDCx5xQ';

export function buildUser(overrides: Partial<Prisma.UserUncheckedCreateInput> = {}): Prisma.UserUncheckedCreateInput {
  const n = nextId();
  return {
    email: overrides.email ?? `user${n}.${faker.string.alphanumeric(6).toLowerCase()}@example.local`,
    passwordHash: PRECOMPUTED_PASSWORD_HASH,
    emailVerifiedAt: new Date(),
    locale: 'ar',
    currency: 'SAR',
    ...overrides,
  };
}

export function buildProfile(userId: string, overrides: Partial<Prisma.UserProfileUncheckedCreateInput> = {}): Prisma.UserProfileUncheckedCreateInput {
  const first = faker.person.firstName();
  const last = faker.person.lastName();
  return {
    userId,
    firstName: first,
    lastName: last,
    username: `${slugify(first)}_${slugify(last)}_${nextId()}`.slice(0, 30),
    ...overrides,
  };
}

export function buildAddress(userId: string, overrides: Partial<Prisma.AddressUncheckedCreateInput> = {}): Prisma.AddressUncheckedCreateInput {
  const cities = ['Riyadh', 'Jeddah', 'Dammam', 'Makkah', 'Madinah', 'Khobar', 'Tabuk', 'Abha'];
  return {
    userId,
    recipientName: faker.person.fullName(),
    phone: `+9665${faker.string.numeric(8)}`,
    country: 'SA',
    region: 'Riyadh',
    city: faker.helpers.arrayElement(cities),
    district: faker.location.street(),
    street: faker.location.streetAddress(),
    building: faker.string.numeric(4),
    postalCode: faker.string.numeric(5),
    isDefaultShipping: true,
    isDefaultBilling: true,
    ...overrides,
  };
}

export function buildCategory(overrides: Partial<Prisma.CategoryUncheckedCreateInput> & { nameEn: string; nameAr: string }): Prisma.CategoryUncheckedCreateInput {
  const slug = overrides.slug ?? slugify(overrides.nameEn);
  return { slug, path: overrides.path ?? slug, depth: 0, ...overrides };
}

export function buildBrand(overrides: Partial<Prisma.BrandUncheckedCreateInput> & { nameEn: string }): Prisma.BrandUncheckedCreateInput {
  return { slug: slugify(overrides.nameEn), nameAr: overrides.nameAr ?? overrides.nameEn, ...overrides };
}

export interface BuildProductArgs {
  sellerId: string;
  storeId: string;
  categoryId: string;
  brandId?: string | null;
  titleEn?: string;
  titleAr?: string;
  price?: number;
  status?: Prisma.ProductUncheckedCreateInput['status'];
  condition?: Prisma.ProductUncheckedCreateInput['condition'];
  type?: Prisma.ProductUncheckedCreateInput['type'];
}

export function buildProduct(args: BuildProductArgs, overrides: Partial<Prisma.ProductUncheckedCreateInput> = {}): Prisma.ProductUncheckedCreateInput {
  const n = nextId();
  const titleEn = args.titleEn ?? faker.commerce.productName();
  const titleAr = args.titleAr ?? `منتج ${n}`;
  const price = args.price ?? faker.number.int({ min: 1000, max: 500000 });
  return {
    sellerId: args.sellerId,
    storeId: args.storeId,
    categoryId: args.categoryId,
    brandId: args.brandId ?? null,
    slug: `${slugify(titleEn)}-${n}`,
    titleAr,
    titleEn,
    descriptionAr: `وصف تفصيلي للمنتج ${titleAr}. ${faker.lorem.sentences(2)}`,
    descriptionEn: faker.commerce.productDescription() + ' ' + faker.lorem.sentences(2),
    sku: `SKU-${n.toString().padStart(6, '0')}`,
    price,
    compareAtPrice: faker.datatype.boolean(0.3) ? Math.round(price * 1.2) : null,
    status: args.status ?? 'ACTIVE',
    condition: args.condition ?? 'NEW',
    type: args.type ?? 'PHYSICAL',
    weightGrams: faker.number.int({ min: 100, max: 20000 }),
    tags: faker.helpers.arrayElements(['gift', 'popular', 'limited', 'eco', 'premium', 'budget'], 2),
    publishedAt: new Date(),
    ...overrides,
  };
}

export function buildVariant(productId: string, overrides: Partial<Prisma.ProductVariantUncheckedCreateInput> = {}): Prisma.ProductVariantUncheckedCreateInput {
  const n = nextId();
  return {
    productId,
    sku: `VAR-${n.toString().padStart(7, '0')}`,
    optionsKey: '',
    options: {},
    isDefault: true,
    ...overrides,
  };
}

export function buildCoupon(overrides: Partial<Prisma.CouponUncheckedCreateInput> = {}): Prisma.CouponUncheckedCreateInput {
  return {
    code: `SAVE${nextId()}`,
    type: 'PERCENTAGE',
    value: 1000,
    startsAt: new Date(Date.now() - 86400000),
    endsAt: new Date(Date.now() + 30 * 86400000),
    perUserLimit: 1,
    ...overrides,
  };
}

export function idempotencyKey(prefix = 'test'): string {
  return `${prefix}-${faker.string.alphanumeric(24)}`;
}

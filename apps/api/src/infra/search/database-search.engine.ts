import { Prisma, type PrismaClient } from '@souq/database';
import { normalizeArabic } from '@souq/shared';
import { PRICE_RANGES, type FacetBucket, type ProductSearchDocument, type SearchEngine, type SearchQuery, type SearchResult, type Suggestion } from './search-engine';

/**
 * Postgres fallback: trigram similarity + tsvector over products. Used when SEARCH_ENGINE=database
 * or automatically when OpenSearch is unreachable. Indexing is a no-op (source of truth is the DB).
 */
export class DatabaseSearchEngine implements SearchEngine {
  readonly name = 'database';
  constructor(private readonly prisma: PrismaClient) {}

  async ensureIndexes(): Promise<void> {
    /* indexes are created by migrations */
  }
  async indexProducts(): Promise<void> {
    /* no-op */
  }
  async removeProduct(): Promise<void> {
    /* no-op */
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const started = Date.now();
    const f = query.filters;
    const where: Prisma.Sql[] = [Prisma.sql`p.status = 'ACTIVE' AND p."deletedAt" IS NULL`];
    const q = query.q?.trim();
    const normalized = q ? normalizeArabic(q) : '';
    if (q) {
      where.push(Prisma.sql`(
        to_tsvector('simple', coalesce(p."titleAr",'') || ' ' || coalesce(p."titleEn",'') || ' ' || immutable_array_to_string(p.tags,' ') || ' ' || immutable_array_to_string(p."searchKeywords",' ')) @@ plainto_tsquery('simple', ${normalized})
        OR p."titleAr" % ${normalized} OR p."titleEn" % ${q} OR p."titleEn" ILIKE ${'%' + q + '%'} OR p."titleAr" ILIKE ${'%' + q + '%'}
        OR b."nameEn" ILIKE ${'%' + q + '%'} OR b."nameAr" ILIKE ${'%' + q + '%'}
      )`);
    }
    if (f.categoryPath) where.push(Prisma.sql`c.path LIKE ${f.categoryPath + '%'}`);
    if (f.brandSlugs?.length) where.push(Prisma.sql`b.slug IN (${Prisma.join(f.brandSlugs)})`);
    if (f.conditions?.length) where.push(Prisma.sql`p.condition::text IN (${Prisma.join(f.conditions)})`);
    if (f.minPrice != null) where.push(Prisma.sql`p.price >= ${f.minPrice}`);
    if (f.maxPrice != null) where.push(Prisma.sql`p.price <= ${f.maxPrice}`);
    if (f.minRating) where.push(Prisma.sql`p."ratingAvg" >= ${f.minRating}`);
    if (f.storeSlug) where.push(Prisma.sql`s.slug = ${f.storeSlug}`);
    if (f.city) where.push(Prisma.sql`p."locationCity" = ${f.city}`);
    if (f.pickup) where.push(Prisma.sql`p."allowsPickup" = true`);
    if (f.listingType) where.push(Prisma.sql`p."listingType"::text = ${f.listingType}`);
    if (f.type) where.push(Prisma.sql`p.type::text = ${f.type}`);
    if (f.inStock) where.push(Prisma.sql`EXISTS (SELECT 1 FROM product_variants v JOIN inventory_items i ON i."variantId" = v.id WHERE v."productId" = p.id AND v."isActive" AND (i."onHand" - i.reserved) > 0)`);
    for (const [k, values] of Object.entries(f.attributes ?? {})) {
      where.push(Prisma.sql`EXISTS (SELECT 1 FROM product_attribute_values pav JOIN attributes a ON a.id = pav."attributeId" WHERE pav."productId" = p.id AND a.key = ${k} AND (pav."valueText" IN (${Prisma.join(values)}) OR pav."valueOptions" && ${values}::text[]))`);
    }
    const whereSql = Prisma.join(where, ' AND ');
    const order = this.order(query.sort, !!q, q ?? '');
    const from = Prisma.sql`FROM products p JOIN categories c ON c.id = p."categoryId" JOIN stores s ON s.id = p."storeId" LEFT JOIN brands b ON b.id = p."brandId" WHERE ${whereSql}`;
    const offset = (query.page - 1) * query.pageSize;

    const [rows, countRows, catFacets, brandFacets, condFacets, cityFacets, priceFacets] = await Promise.all([
      this.prisma.$queryRaw<ProductRow[]>(Prisma.sql`
        SELECT p.id, p.slug, p."titleAr", p."titleEn", p."descriptionAr", p."descriptionEn", p."categoryId", c.path AS "categoryPath", c."nameAr" AS "categoryNameAr", c."nameEn" AS "categoryNameEn",
               p."brandId", b.slug AS "brandSlug", b."nameEn" AS "brandNameEn", b."nameAr" AS "brandNameAr", p."sellerId", p."storeId", s.slug AS "storeSlug", s.name AS "storeName",
               p.condition::text AS condition, p."listingType"::text AS "listingType", p.type::text AS type, p.status::text AS status, p.price, p."compareAtPrice", p.currency,
               p."ratingAvg"::float AS "ratingAvg", p."ratingCount", p."salesCount", p."viewCount", p."allowsPickup", p."allowsShipping", p."locationCity", p.tags, p."searchKeywords" AS keywords,
               (SELECT m.url FROM product_media m WHERE m."productId" = p.id ORDER BY m."isPrimary" DESC, m.position ASC LIMIT 1) AS "imageUrl",
               p."publishedAt", p."createdAt",
               (SELECT a."endsAt" FROM auctions a WHERE a."productId" = p.id) AS "auctionEndsAt",
               EXISTS (SELECT 1 FROM product_variants v JOIN inventory_items i ON i."variantId" = v.id WHERE v."productId" = p.id AND v."isActive" AND (i."onHand" - i.reserved) > 0) AS "inStock"
        ${from} ORDER BY ${order} LIMIT ${query.pageSize} OFFSET ${offset}`),
      this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT count(*)::bigint AS count ${from}`),
      this.prisma.$queryRaw<{ key: string; count: bigint }[]>(Prisma.sql`SELECT c.path AS key, count(*)::bigint AS count ${from} GROUP BY c.path ORDER BY count DESC LIMIT 30`),
      this.prisma.$queryRaw<{ key: string; count: bigint }[]>(Prisma.sql`SELECT b.slug AS key, count(*)::bigint AS count ${from} AND b.slug IS NOT NULL GROUP BY b.slug ORDER BY count DESC LIMIT 30`),
      this.prisma.$queryRaw<{ key: string; count: bigint }[]>(Prisma.sql`SELECT p.condition::text AS key, count(*)::bigint AS count ${from} GROUP BY p.condition ORDER BY count DESC`),
      this.prisma.$queryRaw<{ key: string; count: bigint }[]>(Prisma.sql`SELECT p."locationCity" AS key, count(*)::bigint AS count ${from} AND p."locationCity" IS NOT NULL GROUP BY p."locationCity" ORDER BY count DESC LIMIT 20`),
      this.prisma.$queryRaw<{ key: string; count: bigint }[]>(Prisma.sql`SELECT CASE ${Prisma.join(
        PRICE_RANGES.map((r) => (r.max == null ? Prisma.sql`WHEN p.price >= ${r.min} THEN ${r.key}` : Prisma.sql`WHEN p.price >= ${r.min} AND p.price < ${r.max} THEN ${r.key}`)),
        ' ',
      )} END AS key, count(*)::bigint AS count ${from} GROUP BY 1 ORDER BY 1`),
    ]);
    const toBuckets = (rows: { key: string | null; count: bigint }[]): FacetBucket[] => rows.filter((r) => r.key).map((r) => ({ key: String(r.key), count: Number(r.count) }));
    return {
      hits: rows.map(toDoc),
      total: Number(countRows[0]?.count ?? 0),
      facets: { categories: toBuckets(catFacets), brands: toBuckets(brandFacets), conditions: toBuckets(condFacets), cities: toBuckets(cityFacets), priceRanges: toBuckets(priceFacets), attributes: {} },
      tookMs: Date.now() - started,
      engine: this.name,
    };
  }

  private order(sort: string, hasQuery: boolean, q: string): Prisma.Sql {
    switch (sort) {
      case 'newest':
        return Prisma.sql`p."publishedAt" DESC NULLS LAST`;
      case 'price_asc':
        return Prisma.sql`p.price ASC`;
      case 'price_desc':
        return Prisma.sql`p.price DESC`;
      case 'best_selling':
        return Prisma.sql`p."salesCount" DESC`;
      case 'most_reviewed':
        return Prisma.sql`p."ratingCount" DESC`;
      case 'top_rated':
        return Prisma.sql`p."ratingAvg" DESC, p."ratingCount" DESC`;
      case 'ending_soon':
        return Prisma.sql`(SELECT a."endsAt" FROM auctions a WHERE a."productId" = p.id) ASC NULLS LAST`;
      default:
        return hasQuery
          ? Prisma.sql`GREATEST(similarity(p."titleEn", ${q}), similarity(p."titleAr", ${normalizeArabic(q)})) DESC, p."salesCount" DESC`
          : Prisma.sql`p."salesCount" DESC, p."publishedAt" DESC NULLS LAST`;
    }
  }

  async suggest(prefix: string, locale: 'ar' | 'en', limit = 8): Promise<Suggestion[]> {
    const p = prefix.trim();
    if (!p) return [];
    const like = `%${p}%`;
    const [products, categories, brands, stores] = await Promise.all([
      this.prisma.product.findMany({
        where: { status: 'ACTIVE', deletedAt: null, OR: [{ titleEn: { contains: p, mode: 'insensitive' } }, { titleAr: { contains: p } }] },
        select: { titleAr: true, titleEn: true, slug: true, media: { where: { isPrimary: true }, select: { url: true }, take: 1 } },
        orderBy: { salesCount: 'desc' },
        take: limit,
      }),
      this.prisma.$queryRaw<{ nameAr: string; nameEn: string; slug: string }[]>`SELECT "nameAr","nameEn",slug FROM categories WHERE "isActive" AND ("nameEn" ILIKE ${like} OR "nameAr" ILIKE ${like}) LIMIT 3`,
      this.prisma.$queryRaw<{ nameAr: string; nameEn: string; slug: string }[]>`SELECT "nameAr","nameEn",slug FROM brands WHERE "isActive" AND ("nameEn" ILIKE ${like} OR "nameAr" ILIKE ${like}) LIMIT 3`,
      this.prisma.$queryRaw<{ name: string; slug: string }[]>`SELECT name, slug FROM stores WHERE "isActive" AND (name ILIKE ${like} OR "nameAr" ILIKE ${like}) LIMIT 3`,
    ]);
    return [
      ...products.map((r) => ({ type: 'product' as const, text: locale === 'ar' ? r.titleAr : r.titleEn, slug: r.slug, imageUrl: r.media[0]?.url ?? null })),
      ...categories.map((r) => ({ type: 'category' as const, text: locale === 'ar' ? r.nameAr : r.nameEn, slug: r.slug })),
      ...brands.map((r) => ({ type: 'brand' as const, text: locale === 'ar' ? r.nameAr : r.nameEn, slug: r.slug })),
      ...stores.map((r) => ({ type: 'store' as const, text: r.name, slug: r.slug })),
    ].slice(0, limit + 6);
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }
}

interface ProductRow {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  categoryId: string;
  categoryPath: string;
  categoryNameAr: string;
  categoryNameEn: string;
  brandId: string | null;
  brandSlug: string | null;
  brandNameEn: string | null;
  brandNameAr: string | null;
  sellerId: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  condition: string;
  listingType: string;
  type: string;
  status: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  ratingAvg: number;
  ratingCount: number;
  salesCount: number;
  viewCount: number;
  allowsPickup: boolean;
  allowsShipping: boolean;
  locationCity: string | null;
  tags: string[];
  keywords: string[];
  imageUrl: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  auctionEndsAt: Date | null;
  inStock: boolean;
}

function toDoc(r: ProductRow): ProductSearchDocument {
  return {
    ...r,
    descriptionAr: r.descriptionAr.slice(0, 300),
    descriptionEn: r.descriptionEn.slice(0, 300),
    attributes: {},
    publishedAt: r.publishedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    auctionEndsAt: r.auctionEndsAt?.toISOString() ?? null,
  };
}

import { Client } from '@opensearch-project/opensearch';
import { normalizeArabic } from '@souq/shared';
import type { Logger } from '@souq/observability';
import { PRICE_RANGES, type ProductSearchDocument, type SearchEngine, type SearchQuery, type SearchResult, type Suggestion, type FacetBucket } from './search-engine';

/** OpenSearch implementation with Arabic + English analyzers, fuzziness, facets and completion suggestions. */
export class OpenSearchEngine implements SearchEngine {
  readonly name = 'opensearch';
  private readonly client: Client;
  private readonly index: string;

  constructor(opts: { url: string; username?: string; password?: string; prefix: string }, private readonly logger: Logger) {
    this.client = new Client({ node: opts.url, auth: opts.username ? { username: opts.username, password: opts.password ?? '' } : undefined, requestTimeout: 5000 });
    this.index = `${opts.prefix}-products`;
  }

  async ensureIndexes(): Promise<void> {
    const exists = await this.client.indices.exists({ index: this.index });
    if (exists.body) return;
    await this.client.indices.create({
      index: this.index,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          analysis: {
            filter: {
              arabic_stop: { type: 'stop', stopwords: '_arabic_' },
              arabic_stemmer: { type: 'stemmer', language: 'arabic' },
              english_stemmer: { type: 'stemmer', language: 'english' },
              edge_ngram: { type: 'edge_ngram', min_gram: 2, max_gram: 20 },
              synonyms: { type: 'synonym_graph', synonyms: ['جوال, هاتف, موبايل, phone, mobile', 'لابتوب, حاسوب محمول, laptop, notebook', 'تلفزيون, تلفاز, tv, television', 'سماعة, سماعات, headphones, earbuds'] },
            },
            analyzer: {
              ar: { type: 'custom', tokenizer: 'standard', filter: ['lowercase', 'decimal_digit', 'arabic_normalization', 'arabic_stop', 'synonyms', 'arabic_stemmer'] },
              en: { type: 'custom', tokenizer: 'standard', filter: ['lowercase', 'asciifolding', 'synonyms', 'english_stemmer'] },
              autocomplete: { type: 'custom', tokenizer: 'standard', filter: ['lowercase', 'asciifolding', 'arabic_normalization', 'edge_ngram'] },
              autocomplete_search: { type: 'custom', tokenizer: 'standard', filter: ['lowercase', 'asciifolding', 'arabic_normalization'] },
            },
          },
        },
        mappings: {
          dynamic: false,
          properties: {
            id: { type: 'keyword' },
            slug: { type: 'keyword' },
            titleAr: { type: 'text', analyzer: 'ar', fields: { auto: { type: 'text', analyzer: 'autocomplete', search_analyzer: 'autocomplete_search' } } },
            titleEn: { type: 'text', analyzer: 'en', fields: { auto: { type: 'text', analyzer: 'autocomplete', search_analyzer: 'autocomplete_search' } } },
            descriptionAr: { type: 'text', analyzer: 'ar' },
            descriptionEn: { type: 'text', analyzer: 'en' },
            categoryId: { type: 'keyword' },
            categoryPath: { type: 'keyword' },
            categoryNameAr: { type: 'keyword' },
            categoryNameEn: { type: 'keyword' },
            brandId: { type: 'keyword' },
            brandSlug: { type: 'keyword' },
            brandNameEn: { type: 'keyword' },
            brandNameAr: { type: 'keyword' },
            sellerId: { type: 'keyword' },
            storeId: { type: 'keyword' },
            storeSlug: { type: 'keyword' },
            storeName: { type: 'text', fields: { kw: { type: 'keyword' } } },
            condition: { type: 'keyword' },
            listingType: { type: 'keyword' },
            type: { type: 'keyword' },
            status: { type: 'keyword' },
            price: { type: 'long' },
            compareAtPrice: { type: 'long' },
            currency: { type: 'keyword' },
            ratingAvg: { type: 'float' },
            ratingCount: { type: 'integer' },
            salesCount: { type: 'integer' },
            viewCount: { type: 'integer' },
            inStock: { type: 'boolean' },
            allowsPickup: { type: 'boolean' },
            allowsShipping: { type: 'boolean' },
            locationCity: { type: 'keyword' },
            tags: { type: 'keyword' },
            keywords: { type: 'text', analyzer: 'en' },
            attributes: { type: 'flat_object' },
            imageUrl: { type: 'keyword', index: false },
            publishedAt: { type: 'date' },
            createdAt: { type: 'date' },
            auctionEndsAt: { type: 'date' },
          },
        },
      },
    });
  }

  async indexProducts(docs: ProductSearchDocument[]): Promise<void> {
    if (!docs.length) return;
    const body = docs.flatMap((d) => [{ index: { _index: this.index, _id: d.id } }, d]);
    const res = await this.client.bulk({ body, refresh: 'wait_for' });
    if (res.body.errors) this.logger.warn({ items: res.body.items?.filter((i: { index?: { error?: unknown } }) => i.index?.error).slice(0, 3) }, 'Some documents failed to index');
  }

  async removeProduct(id: string): Promise<void> {
    await this.client.delete({ index: this.index, id, refresh: 'wait_for' }).catch(() => undefined);
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const started = Date.now();
    const filter: unknown[] = [{ term: { status: 'ACTIVE' } }];
    const f = query.filters;
    if (f.categoryPath) filter.push({ prefix: { categoryPath: f.categoryPath } });
    if (f.brandSlugs?.length) filter.push({ terms: { brandSlug: f.brandSlugs } });
    if (f.conditions?.length) filter.push({ terms: { condition: f.conditions } });
    if (f.minPrice != null || f.maxPrice != null) filter.push({ range: { price: { gte: f.minPrice ?? 0, lte: f.maxPrice ?? undefined } } });
    if (f.minRating) filter.push({ range: { ratingAvg: { gte: f.minRating } } });
    if (f.storeSlug) filter.push({ term: { storeSlug: f.storeSlug } });
    if (f.city) filter.push({ term: { locationCity: f.city } });
    if (f.inStock) filter.push({ term: { inStock: true } });
    if (f.pickup) filter.push({ term: { allowsPickup: true } });
    if (f.listingType) filter.push({ term: { listingType: f.listingType } });
    if (f.type) filter.push({ term: { type: f.type } });
    for (const [k, values] of Object.entries(f.attributes ?? {})) filter.push({ terms: { [`attributes.${k}`]: values } });

    const q = query.q?.trim();
    const must = q
      ? [
          {
            multi_match: {
              query: query.locale === 'ar' ? normalizeArabic(q) : q,
              fields: ['titleAr^4', 'titleEn^4', 'titleAr.auto^2', 'titleEn.auto^2', 'brandNameEn^2', 'brandNameAr^2', 'categoryNameEn', 'categoryNameAr', 'keywords^2', 'tags', 'descriptionAr', 'descriptionEn', 'storeName'],
              type: 'best_fields',
              fuzziness: 'AUTO',
              prefix_length: 1,
              operator: 'and',
            },
          },
        ]
      : [{ match_all: {} }];

    const sort = this.sort(query.sort, !!q);
    const res = await this.client.search({
      index: this.index,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- OpenSearch typings do not model dynamic sort/aggs well
      body: {
        from: (query.page - 1) * query.pageSize,
        size: query.pageSize,
        track_total_hits: true,
        query: { bool: { must, filter } },
        sort,
        aggs: {
          categories: { terms: { field: 'categoryPath', size: 30 } },
          brands: { terms: { field: 'brandSlug', size: 30 } },
          conditions: { terms: { field: 'condition', size: 10 } },
          cities: { terms: { field: 'locationCity', size: 20 } },
          prices: { range: { field: 'price', ranges: PRICE_RANGES.map((r) => ({ key: r.key, from: r.min, to: r.max ?? undefined })) } },
        },
      } as unknown as Record<string, unknown>,
    });
    const body = res.body as unknown as { hits: { total: { value: number }; hits: { _source: ProductSearchDocument }[] }; aggregations: Record<string, { buckets: { key: string; doc_count: number }[] }> };
    const bucket = (name: string): FacetBucket[] => (body.aggregations?.[name]?.buckets ?? []).map((b) => ({ key: String(b.key), count: b.doc_count }));
    return {
      hits: body.hits.hits.map((h) => h._source),
      total: body.hits.total.value,
      facets: { categories: bucket('categories'), brands: bucket('brands'), conditions: bucket('conditions'), cities: bucket('cities'), priceRanges: bucket('prices'), attributes: {} },
      tookMs: Date.now() - started,
      engine: this.name,
    };
  }

  private sort(sort: string, hasQuery: boolean): unknown[] {
    switch (sort) {
      case 'newest':
        return [{ publishedAt: 'desc' }];
      case 'price_asc':
        return [{ price: 'asc' }];
      case 'price_desc':
        return [{ price: 'desc' }];
      case 'best_selling':
        return [{ salesCount: 'desc' }];
      case 'most_reviewed':
        return [{ ratingCount: 'desc' }];
      case 'top_rated':
        return [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }];
      case 'ending_soon':
        return [{ auctionEndsAt: { order: 'asc', missing: '_last' } }];
      default:
        return hasQuery ? ['_score', { salesCount: 'desc' }] : [{ salesCount: 'desc' }, { publishedAt: 'desc' }];
    }
  }

  async suggest(prefix: string, locale: 'ar' | 'en', limit = 8): Promise<Suggestion[]> {
    const res = await this.client.search({
      index: this.index,
      body: {
        size: limit,
        _source: ['titleAr', 'titleEn', 'slug', 'imageUrl', 'brandNameEn', 'categoryNameEn', 'categoryNameAr'],
        query: { bool: { must: [{ multi_match: { query: prefix, fields: ['titleAr.auto', 'titleEn.auto'], type: 'bool_prefix' } }], filter: [{ term: { status: 'ACTIVE' } }] } },
      },
    });
    const hits = (res.body as unknown as { hits: { hits: { _source: ProductSearchDocument }[] } }).hits.hits;
    return hits.map((h) => ({ type: 'product' as const, text: locale === 'ar' ? h._source.titleAr : h._source.titleEn, slug: h._source.slug, imageUrl: h._source.imageUrl }));
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await this.client.cluster.health({ timeout: '2s' });
      return ['green', 'yellow'].includes((res.body as { status: string }).status);
    } catch {
      return false;
    }
  }
}

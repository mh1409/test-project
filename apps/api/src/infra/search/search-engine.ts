export interface ProductSearchDocument {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  categoryId: string;
  categoryPath: string; // "electronics/phones/smartphones"
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
  inStock: boolean;
  allowsPickup: boolean;
  allowsShipping: boolean;
  locationCity: string | null;
  tags: string[];
  keywords: string[];
  attributes: Record<string, string[]>; // attributeKey -> values
  imageUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  auctionEndsAt: string | null;
}

export interface SearchQuery {
  q?: string;
  locale: 'ar' | 'en';
  page: number;
  pageSize: number;
  sort: string;
  filters: {
    categoryPath?: string;
    brandSlugs?: string[];
    conditions?: string[];
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    storeSlug?: string;
    city?: string;
    inStock?: boolean;
    pickup?: boolean;
    listingType?: string;
    type?: string;
    attributes?: Record<string, string[]>;
  };
}

export interface FacetBucket {
  key: string;
  label?: string;
  count: number;
}
export interface SearchFacets {
  categories: FacetBucket[];
  brands: FacetBucket[];
  conditions: FacetBucket[];
  priceRanges: FacetBucket[];
  attributes: Record<string, FacetBucket[]>;
  cities: FacetBucket[];
}
export interface SearchResult {
  hits: ProductSearchDocument[];
  total: number;
  facets: SearchFacets;
  tookMs: number;
  engine: string;
}
export interface Suggestion {
  type: 'product' | 'category' | 'brand' | 'store' | 'query';
  text: string;
  slug?: string;
  imageUrl?: string | null;
}

export interface SearchEngine {
  readonly name: string;
  ensureIndexes(): Promise<void>;
  indexProducts(docs: ProductSearchDocument[]): Promise<void>;
  removeProduct(id: string): Promise<void>;
  search(query: SearchQuery): Promise<SearchResult>;
  suggest(prefix: string, locale: 'ar' | 'en', limit?: number): Promise<Suggestion[]>;
  isHealthy(): Promise<boolean>;
}
export const SEARCH_ENGINE = Symbol('SEARCH_ENGINE');
export const PRICE_RANGES = [
  { key: '0-5000', min: 0, max: 5000 },
  { key: '5000-20000', min: 5000, max: 20000 },
  { key: '20000-50000', min: 20000, max: 50000 },
  { key: '50000-200000', min: 50000, max: 200000 },
  { key: '200000-', min: 200000, max: null },
];

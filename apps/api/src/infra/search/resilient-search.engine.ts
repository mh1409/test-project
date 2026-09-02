import type { Logger } from '@souq/observability';
import { DependencyUnavailableError } from '@souq/shared';
import type { ProductSearchDocument, SearchEngine, SearchQuery, SearchResult, Suggestion } from './search-engine';

/**
 * Circuit-breaking wrapper: primary engine (OpenSearch) with automatic fallback to the
 * database engine for reads; writes are queued for retry by the indexing worker.
 */
export class ResilientSearchEngine implements SearchEngine {
  readonly name: string;
  private failures = 0;
  private openUntil = 0;

  constructor(private readonly primary: SearchEngine, private readonly fallback: SearchEngine, private readonly logger: Logger) {
    this.name = `${primary.name}+${fallback.name}`;
  }

  private get circuitOpen(): boolean {
    return Date.now() < this.openUntil;
  }
  private trip(err: unknown): void {
    this.failures += 1;
    if (this.failures >= 3) {
      this.openUntil = Date.now() + 30_000;
      this.failures = 0;
      this.logger.warn({ err: (err as Error).message }, 'Search circuit opened; using database fallback for 30s');
    }
  }

  async ensureIndexes(): Promise<void> {
    try {
      await this.primary.ensureIndexes();
    } catch (err) {
      this.logger.warn({ err: (err as Error).message }, 'Could not ensure search indexes');
    }
  }
  async indexProducts(docs: ProductSearchDocument[]): Promise<void> {
    if (this.circuitOpen) throw new DependencyUnavailableError('search');
    try {
      await this.primary.indexProducts(docs);
      this.failures = 0;
    } catch (err) {
      this.trip(err);
      throw err;
    }
  }
  async removeProduct(id: string): Promise<void> {
    if (this.circuitOpen) throw new DependencyUnavailableError('search');
    await this.primary.removeProduct(id);
  }
  async search(query: SearchQuery): Promise<SearchResult> {
    if (!this.circuitOpen) {
      try {
        const r = await this.primary.search(query);
        this.failures = 0;
        return r;
      } catch (err) {
        this.trip(err);
      }
    }
    return this.fallback.search(query);
  }
  async suggest(prefix: string, locale: 'ar' | 'en', limit?: number): Promise<Suggestion[]> {
    if (!this.circuitOpen) {
      try {
        return await this.primary.suggest(prefix, locale, limit);
      } catch (err) {
        this.trip(err);
      }
    }
    return this.fallback.suggest(prefix, locale, limit);
  }
  async isHealthy(): Promise<boolean> {
    return this.primary.isHealthy();
  }
}

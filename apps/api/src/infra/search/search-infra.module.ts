import { Global, Module } from '@nestjs/common';
import { ENV, LOGGER, type Env, type Logger } from '../config/config.module';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseSearchEngine } from './database-search.engine';
import { OpenSearchEngine } from './opensearch.engine';
import { ResilientSearchEngine } from './resilient-search.engine';
import { SEARCH_ENGINE, type SearchEngine } from './search-engine';

@Global()
@Module({
  providers: [
    {
      provide: SEARCH_ENGINE,
      useFactory: (env: Env, prisma: PrismaService, logger: Logger): SearchEngine => {
        const db = new DatabaseSearchEngine(prisma);
        if (env.SEARCH_ENGINE !== 'opensearch' || env.NODE_ENV === 'test') return db;
        const os = new OpenSearchEngine({ url: env.OPENSEARCH_URL, username: env.OPENSEARCH_USERNAME, password: env.OPENSEARCH_PASSWORD, prefix: env.SEARCH_INDEX_PREFIX }, logger);
        return new ResilientSearchEngine(os, db, logger);
      },
      inject: [ENV, PrismaService, LOGGER],
    },
  ],
  exports: [SEARCH_ENGINE],
})
export class SearchInfraModule {}

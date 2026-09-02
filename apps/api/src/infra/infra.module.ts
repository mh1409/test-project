import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { AuthInfraModule } from './auth/auth-infra.module';
import { CacheModule } from './cache/cache.module';
import { ConfigModule } from './config/config.module';
import { EventsModule } from './events/events.module';
import { FeatureFlagModule } from './feature-flags/feature-flag.module';
import { HealthModule } from './health/health.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { JobsModule } from './jobs/job-registry';
import { LockModule } from './lock/lock.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProvidersModule } from './providers/providers.module';
import { PushModule } from './push/push.provider';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { SearchInfraModule } from './search/search-infra.module';
import { SmsModule } from './sms/sms.provider';
import { StorageModule } from './storage/storage.module';

/** All cross-cutting infrastructure (global providers). Domain modules import nothing from here explicitly. */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    CacheModule,
    LockModule,
    AuthInfraModule,
    FeatureFlagModule,
    IdempotencyModule,
    AuditModule,
    EventsModule,
    QueueModule,
    JobsModule,
    StorageModule,
    MailModule,
    SmsModule,
    PushModule,
    ProvidersModule,
    SearchInfraModule,
    HealthModule,
  ],
})
export class InfraModule {}

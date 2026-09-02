import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/config.module';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { STORAGE_PROVIDER, VIRUS_SCANNER, type StorageProvider, type VirusScanner } from './storage.provider';
import { MockVirusScanner, NoopVirusScanner } from './virus-scanner';

@Global()
@Module({
  providers: [
    { provide: STORAGE_PROVIDER, useFactory: (env: Env): StorageProvider => (env.STORAGE_DRIVER === 's3' ? new S3StorageProvider(env) : new LocalStorageProvider(env)), inject: [ENV] },
    { provide: VIRUS_SCANNER, useFactory: (env: Env): VirusScanner => (env.VIRUS_SCANNER === 'mock' ? new MockVirusScanner() : new NoopVirusScanner()), inject: [ENV] },
  ],
  exports: [STORAGE_PROVIDER, VIRUS_SCANNER],
})
export class StorageModule {}

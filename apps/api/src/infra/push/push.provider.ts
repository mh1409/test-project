import { Global, Module } from '@nestjs/common';
import type { Logger } from '@souq/observability';
import { LOGGER } from '../config/config.module';

export interface PushMessage {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}
export interface PushProvider {
  readonly name: string;
  send(message: PushMessage): Promise<{ sent: number; invalidTokens: string[] }>;
}
export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');

export class LogPushProvider implements PushProvider {
  readonly name = 'log';
  constructor(private readonly logger: Logger) {}
  async send(message: PushMessage): Promise<{ sent: number; invalidTokens: string[] }> {
    this.logger.info({ count: message.tokens.length, title: message.title }, 'Push (log provider)');
    return { sent: message.tokens.length, invalidTokens: [] };
  }
}

@Global()
@Module({ providers: [{ provide: PUSH_PROVIDER, useFactory: (logger: Logger): PushProvider => new LogPushProvider(logger), inject: [LOGGER] }], exports: [PUSH_PROVIDER] })
export class PushModule {}

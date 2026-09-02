import { randomUUID } from 'node:crypto';
import type { Logger } from '@souq/observability';
import { maskEmail } from '@souq/shared';
import type { MailMessage, MailProvider } from './mail.provider';

/** Development provider: logs the message (masked recipient) and keeps the last 100 in memory for tests. */
export class LogMailProvider implements MailProvider {
  readonly name = 'log';
  readonly sent: MailMessage[] = [];
  constructor(private readonly logger: Logger) {}
  async send(message: MailMessage): Promise<{ messageId: string }> {
    this.sent.push(message);
    if (this.sent.length > 100) this.sent.shift();
    this.logger.info({ to: maskEmail(message.to), subject: message.subject }, 'Email (log provider)');
    return { messageId: randomUUID() };
  }
  async isHealthy(): Promise<boolean> {
    return true;
  }
}

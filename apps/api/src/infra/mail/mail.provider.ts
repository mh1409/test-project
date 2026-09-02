export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}
export interface MailProvider {
  readonly name: string;
  send(message: MailMessage): Promise<{ messageId: string }>;
  isHealthy(): Promise<boolean>;
}
export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');

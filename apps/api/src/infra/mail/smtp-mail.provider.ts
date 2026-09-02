import nodemailer, { type Transporter } from 'nodemailer';
import type { MailMessage, MailProvider } from './mail.provider';

export class SmtpMailProvider implements MailProvider {
  readonly name = 'smtp';
  private readonly transporter: Transporter;
  constructor(url: string, private readonly from: string) {
    this.transporter = nodemailer.createTransport(url);
  }
  async send(message: MailMessage): Promise<{ messageId: string }> {
    const info = await this.transporter.sendMail({ from: this.from, to: message.to, subject: message.subject, html: message.html, text: message.text, replyTo: message.replyTo });
    return { messageId: String(info.messageId) };
  }
  async isHealthy(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}

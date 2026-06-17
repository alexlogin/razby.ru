import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EmailMessage, EmailProvider, SmsProvider } from './messaging.provider';

/** Mock-SMS: логирует код в консоль (виден при локальном запуске). */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger('MockSMS');

  async send(to: string, text: string): Promise<{ id: string }> {
    this.logger.log(`SMS → ${to}: ${text}`);
    return { id: randomUUID() };
  }
}

/** Mock-Email: логирует письмо в консоль. */
@Injectable()
export class MockEmailProvider implements EmailProvider {
  private readonly logger = new Logger('MockEmail');

  async send(message: EmailMessage): Promise<{ id: string }> {
    this.logger.log(`EMAIL → ${message.to}: ${message.subject}\n${message.text ?? message.html}`);
    return { id: randomUUID() };
  }
}

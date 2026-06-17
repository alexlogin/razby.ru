import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CreatePaymentInput,
  PaymentProvider,
  PaymentResult,
} from './payment.provider';

/**
 * Mock-эскроу: средства "удерживаются" и "выплачиваются" в памяти.
 * Реализует полный жизненный цикл без внешнего платёжного шлюза.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger('MockPayment');
  private readonly store = new Map<string, PaymentResult>();

  async createHold(input: CreatePaymentInput): Promise<PaymentResult> {
    const externalId = `mock_${randomUUID()}`;
    const result: PaymentResult = {
      externalId,
      status: 'HELD',
      confirmationUrl: `https://pay.mock.razby.ru/confirm/${externalId}`,
    };
    this.store.set(externalId, result);
    this.logger.log(`Удержание ${input.amount} ${input.currency} → ${externalId}`);
    return result;
  }

  async capture(externalId: string): Promise<PaymentResult> {
    const result: PaymentResult = { externalId, status: 'RELEASED' };
    this.store.set(externalId, result);
    this.logger.log(`Выплата по ${externalId}`);
    return result;
  }

  async refund(externalId: string): Promise<PaymentResult> {
    const result: PaymentResult = { externalId, status: 'REFUNDED' };
    this.store.set(externalId, result);
    this.logger.log(`Возврат по ${externalId}`);
    return result;
  }
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface CreatePaymentInput {
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  externalId: string;
  status: 'PENDING' | 'HELD' | 'RELEASED' | 'REFUNDED' | 'FAILED';
  confirmationUrl?: string;
}

/** Контракт платёжного провайдера (эскроу-модель). */
export interface PaymentProvider {
  createHold(input: CreatePaymentInput): Promise<PaymentResult>;
  capture(externalId: string): Promise<PaymentResult>;
  refund(externalId: string): Promise<PaymentResult>;
}

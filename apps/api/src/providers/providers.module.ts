import { Global, Module } from '@nestjs/common';
import { STORAGE_PROVIDER } from './storage/storage.provider';
import { MockStorageProvider } from './storage/mock-storage.provider';
import { EMAIL_PROVIDER, SMS_PROVIDER } from './messaging/messaging.provider';
import { MockEmailProvider, MockSmsProvider } from './messaging/mock-messaging.provider';
import { PAYMENT_PROVIDER } from './payments/payment.provider';
import { MockPaymentProvider } from './payments/mock-payment.provider';

/**
 * Регистрация провайдеров внешних сервисов.
 * По умолчанию подключены рабочие mock-реализации (STORAGE_DRIVER=mock и т.д.).
 * Для прод-режима достаточно подменить класс на S3/SMSC/SMTP/ЮKassa реализацию.
 */
@Global()
@Module({
  providers: [
    { provide: STORAGE_PROVIDER, useClass: MockStorageProvider },
    { provide: SMS_PROVIDER, useClass: MockSmsProvider },
    { provide: EMAIL_PROVIDER, useClass: MockEmailProvider },
    { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider },
  ],
  exports: [STORAGE_PROVIDER, SMS_PROVIDER, EMAIL_PROVIDER, PAYMENT_PROVIDER],
})
export class ProvidersModule {}

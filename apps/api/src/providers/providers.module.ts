import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE_PROVIDER } from './storage/storage.provider';
import { MockStorageProvider } from './storage/mock-storage.provider';
import { EMAIL_PROVIDER, SMS_PROVIDER } from './messaging/messaging.provider';
import { MockEmailProvider, MockSmsProvider } from './messaging/mock-messaging.provider';
import { PAYMENT_PROVIDER } from './payments/payment.provider';
import { MockPaymentProvider } from './payments/mock-payment.provider';
import { AI_PROVIDER } from './ai/ai.provider';
import { HeuristicAiProvider } from './ai/heuristic-ai.provider';
import { OpenRouterAiProvider } from './ai/openrouter-ai.provider';

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
    HeuristicAiProvider,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const ai = config.get<{
          driver: string;
          apiKey?: string;
          model: string;
          baseUrl: string;
          appUrl: string;
        }>('app.ai')!;
        const heuristic = new HeuristicAiProvider();
        if (ai.driver === 'openrouter' && ai.apiKey) {
          return new OpenRouterAiProvider(
            { apiKey: ai.apiKey, model: ai.model, baseUrl: ai.baseUrl, appUrl: ai.appUrl },
            heuristic,
          );
        }
        return heuristic;
      },
    },
  ],
  exports: [STORAGE_PROVIDER, SMS_PROVIDER, EMAIL_PROVIDER, PAYMENT_PROVIDER, AI_PROVIDER, HeuristicAiProvider],
})
export class ProvidersModule {}

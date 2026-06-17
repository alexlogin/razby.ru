import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded, static as serveStatic } from 'express';
import { resolve } from 'path';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const appConfig = config.get<AppConfig>('app')!;

  app.setGlobalPrefix('api', { exclude: ['health', 'health/ready'] });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  app.enableCors({
    origin: appConfig.corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Раздача загруженных файлов (mock-хранилище)
  app.use('/files', serveStatic(resolve(process.cwd(), 'storage')));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Razby.ru API')
    .setDescription('API платформы Razby.ru — «Разберу стройку на части»')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(appConfig.port, '0.0.0.0');
  new Logger('Bootstrap').log(
    `Razby.ru API запущен на порту ${appConfig.port} (env=${appConfig.env}). Swagger: /api/docs`,
  );
}

void bootstrap();

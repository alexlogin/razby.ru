import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { dirname, join, resolve } from 'path';
import {
  PresignedUpload,
  PutObjectInput,
  StorageProvider,
} from './storage.provider';

/**
 * Рабочее локальное хранилище: пишет файлы в каталог storage/.
 * Полноценная замена S3 для локального запуска без внешних сервисов.
 */
@Injectable()
export class MockStorageProvider implements StorageProvider {
  private readonly logger = new Logger(MockStorageProvider.name);
  private readonly root = resolve(process.cwd(), 'storage');
  private readonly publicBase: string;

  constructor(private readonly config: ConfigService) {
    this.publicBase = this.config.get<string>('app.storage.publicBaseUrl')!;
  }

  async putObject(input: PutObjectInput): Promise<{ key: string; url: string }> {
    const filePath = join(this.root, input.key);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, input.body);
    this.logger.debug(`Сохранён объект ${input.key} (${input.body.length} байт)`);
    return { key: input.key, url: this.getPublicUrl(input.key) };
  }

  getPublicUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }

  async presignUpload(key: string, _contentType: string): Promise<PresignedUpload> {
    // В mock-режиме клиент загружает через REST-эндпоинт /uploads
    return {
      key,
      uploadUrl: `${this.publicBase.replace(/\/files$/, '')}/uploads/direct?key=${encodeURIComponent(key)}`,
      publicUrl: this.getPublicUrl(key),
      expiresInSec: 3600,
    };
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await fs.unlink(join(this.root, key));
    } catch {
      // объект мог быть уже удалён
    }
  }
}

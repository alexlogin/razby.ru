import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type AiProvider } from '../providers/ai/ai.provider';
import { HeuristicAiProvider } from '../providers/ai/heuristic-ai.provider';
import { OpenRouterAiProvider } from '../providers/ai/openrouter-ai.provider';
import { UpdateAiSettingsDto } from './dto/ai-settings.dto';

/** Ключ системной настройки, в которой хранится конфиг ИИ-агента (редактируется в админке). */
export const AI_SETTINGS_KEY = 'ai.settings';

interface StoredAiSettings {
  driver?: 'heuristic' | 'openrouter';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

interface EnvAiConfig {
  driver: 'heuristic' | 'openrouter';
  apiKey?: string;
  model: string;
  baseUrl: string;
  appUrl: string;
}

export interface AiSettingsView {
  driver: 'heuristic' | 'openrouter';
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
  keyMask: string | null;
  /** Откуда взялся ключ/настройки: из админки (db) или из переменных окружения (env). */
  source: 'db' | 'env';
}

/**
 * Настройки ИИ-агента с приоритетом: значения из админки (SystemSetting) поверх env.
 * Позволяет включать OpenRouter и менять ключ/модель из админки без правки сервера.
 */
@Injectable()
export class AiSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly heuristic: HeuristicAiProvider,
  ) {}

  private env(): EnvAiConfig {
    return this.config.get<EnvAiConfig>('app.ai')!;
  }

  private async stored(): Promise<StoredAiSettings> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: AI_SETTINGS_KEY } });
    return (row?.value as StoredAiSettings | undefined) ?? {};
  }

  /** Действующие настройки: админка поверх env. */
  private async effective(): Promise<EnvAiConfig> {
    const env = this.env();
    const s = await this.stored();
    return {
      driver: s.driver ?? env.driver,
      apiKey: s.apiKey ?? env.apiKey,
      model: s.model ?? env.model,
      baseUrl: s.baseUrl ?? env.baseUrl,
      appUrl: env.appUrl,
    };
  }

  /** Строит провайдера под действующие настройки (вызывается на каждый запрос анализа). */
  async getProvider(): Promise<AiProvider> {
    const s = await this.effective();
    if (s.driver === 'openrouter' && s.apiKey) {
      return new OpenRouterAiProvider(
        { apiKey: s.apiKey, model: s.model, baseUrl: s.baseUrl, appUrl: s.appUrl },
        this.heuristic,
      );
    }
    return this.heuristic;
  }

  /** Безопасное представление для админки (ключ маскируется). */
  async getForAdmin(): Promise<AiSettingsView> {
    const env = this.env();
    const s = await this.stored();
    const apiKey = s.apiKey ?? env.apiKey;
    const sourceDb = s.driver != null || s.model != null || s.baseUrl != null || s.apiKey != null;
    return {
      driver: s.driver ?? env.driver,
      model: s.model ?? env.model,
      baseUrl: s.baseUrl ?? env.baseUrl,
      hasApiKey: !!apiKey,
      keyMask: this.mask(apiKey),
      source: sourceDb ? 'db' : 'env',
    };
  }

  async update(dto: UpdateAiSettingsDto, actorId: string): Promise<AiSettingsView> {
    const current = await this.stored();
    const next: StoredAiSettings = { ...current };
    if (dto.driver) next.driver = dto.driver;
    if (dto.model !== undefined) next.model = dto.model.trim() || undefined;
    if (dto.baseUrl !== undefined) next.baseUrl = dto.baseUrl.trim() || undefined;
    // apiKey: пустая строка очищает, отсутствие поля — оставить как было.
    if (dto.apiKey !== undefined) next.apiKey = dto.apiKey.trim() || undefined;

    await this.prisma.systemSetting.upsert({
      where: { key: AI_SETTINGS_KEY },
      create: { key: AI_SETTINGS_KEY, value: next as object },
      update: { value: next as object },
    });
    // В аудит не пишем сам ключ — только факт изменения и режим.
    await this.audit.log({
      actorId,
      action: 'admin.ai.settings',
      entityType: 'SystemSetting',
      entityId: AI_SETTINGS_KEY,
      after: { driver: next.driver, model: next.model, hasApiKey: !!next.apiKey },
    });
    return this.getForAdmin();
  }

  private mask(key?: string): string | null {
    if (!key) return null;
    if (key.length <= 4) return '••••';
    return `••••${key.slice(-4)}`;
  }
}

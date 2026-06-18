import { Injectable, Logger } from '@nestjs/common';
import {
  AiProvider,
  AiTemplateContext,
  AiUnderstanding,
  AiUnderstandInput,
} from './ai.provider';

/**
 * Офлайн-понимание запроса без внешних сервисов: сопоставление по ключевым
 * словам и извлечение габаритов регулярными выражениями. Работает бесплатно
 * и используется по умолчанию, а также как фолбэк при сбое LLM.
 */
@Injectable()
export class HeuristicAiProvider implements AiProvider {
  private readonly logger = new Logger(HeuristicAiProvider.name);

  async understand(input: AiUnderstandInput): Promise<AiUnderstanding> {
    const q = input.query.toLowerCase();
    const match = this.bestMatch(q, input.templates);
    const dims = this.extractDimensions(q);

    if (!match) {
      return {
        summary: `Запрос: «${input.query.trim()}». Подходящего готового шаблона не найдено — опишите задачу детальнее или создайте проект вручную.`,
        matchedSlug: null,
        confidence: 0,
        parameters: {},
        proposedStages: this.genericStages(q),
        source: 'heuristic',
      };
    }

    const parameters = this.mapDimensions(match.template, dims);
    const filled = Object.keys(parameters).length;
    const summaryParts = [`Понял запрос как «${match.template.name}»`];
    if (filled > 0) {
      summaryParts.push(
        `извлечены параметры: ${Object.entries(parameters)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}`,
      );
    }

    return {
      summary: summaryParts.join('. ') + '.',
      matchedSlug: match.template.slug,
      confidence: match.confidence,
      parameters,
      proposedStages: [],
      source: 'heuristic',
    };
  }

  private bestMatch(
    q: string,
    templates: AiTemplateContext[],
  ): { template: AiTemplateContext; confidence: number } | null {
    const queryTokens = this.tokenize(q).filter((t) => t.length >= 3);
    let best: { template: AiTemplateContext; score: number; total: number } | null = null;
    for (const t of templates) {
      const keywords = Array.from(
        new Set([...t.keywords, ...this.tokenize(t.name)].map((k) => k.toLowerCase())),
      ).filter((k) => k.length >= 3);
      let score = 0;
      for (const k of keywords) {
        if (queryTokens.some((qt) => this.tokensMatch(qt, k))) score += 1;
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { template: t, score, total: keywords.length };
      }
    }
    if (!best) return null;
    // Уверенность: насколько покрыты ключевые слова, но не ниже 0.4 при попадании.
    const confidence = Math.min(1, Math.max(0.4, best.score / Math.max(1, Math.min(best.total, 4))));
    return { template: best.template, confidence: Number(confidence.toFixed(2)) };
  }

  /** Совпадение слов по общему корню (префиксу) — «погреб» ≈ «погреба». */
  private tokensMatch(a: string, b: string): boolean {
    if (a === b) return true;
    const min = Math.min(a.length, b.length);
    if (min < 4) return false;
    const prefix = Math.max(4, min - 2);
    return a.slice(0, prefix) === b.slice(0, prefix);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  /** Извлекает до трёх габаритов из строк вида «3x2x2», «3х2х2», «3 на 2 на 2», «длина 3». */
  private extractDimensions(q: string): { length?: number; width?: number; height?: number } {
    const norm = q.replace(',', '.');
    const result: { length?: number; width?: number; height?: number } = {};

    const triple = norm.match(
      /(\d+(?:\.\d+)?)\s*[xх*×]\s*(\d+(?:\.\d+)?)\s*[xх*×]\s*(\d+(?:\.\d+)?)/,
    );
    const tripleWords = norm.match(
      /(\d+(?:\.\d+)?)\s*на\s*(\d+(?:\.\d+)?)\s*на\s*(\d+(?:\.\d+)?)/,
    );
    const m = triple ?? tripleWords;
    if (m) {
      result.length = Number(m[1]);
      result.width = Number(m[2]);
      result.height = Number(m[3]);
    }

    const named: Array<[RegExp, keyof typeof result]> = [
      [/длин[аеуы]?\s*[:=]?\s*(\d+(?:\.\d+)?)/, 'length'],
      [/ширин[аеуы]?\s*[:=]?\s*(\d+(?:\.\d+)?)/, 'width'],
      [/высот[аеуы]?\s*[:=]?\s*(\d+(?:\.\d+)?)/, 'height'],
      [/глубин[аеуы]?\s*[:=]?\s*(\d+(?:\.\d+)?)/, 'height'],
    ];
    for (const [re, key] of named) {
      const mm = norm.match(re);
      if (mm) result[key] = Number(mm[1]);
    }
    return result;
  }

  /** Привязывает извлечённые габариты к параметрам шаблона по суффиксам ключей. */
  private mapDimensions(
    template: AiTemplateContext,
    dims: { length?: number; width?: number; height?: number },
  ): Record<string, number> {
    const out: Record<string, number> = {};
    for (const p of template.parameters) {
      const key = p.key.toLowerCase();
      if (dims.length != null && key.endsWith('length')) out[p.key] = dims.length;
      else if (dims.width != null && key.endsWith('width')) out[p.key] = dims.width;
      else if (dims.height != null && (key.endsWith('height') || key.endsWith('depth')))
        out[p.key] = dims.height;
    }
    return out;
  }

  private genericStages(q: string): { name: string; note?: string }[] {
    const stages = [
      { name: 'Анализ задачи и условий', note: 'Уточнение объёма, материалов и доступа' },
      { name: 'Подготовительные работы' },
      { name: 'Основные работы' },
      { name: 'Финишные работы и приёмка' },
    ];
    if (/(монтаж|установ|строит)/.test(q)) {
      stages.splice(2, 0, { name: 'Закупка материалов' });
    }
    return stages;
  }
}

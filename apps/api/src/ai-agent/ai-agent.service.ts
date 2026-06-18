import { Injectable, Logger } from '@nestjs/common';
import type { AiAnalyzeResult, AiAnalyzeStage } from '@razby/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FormulasService } from '../formulas/formulas.service';
import { type AiTemplateContext } from '../providers/ai/ai.provider';
import { AiSettingsService } from './ai-settings.service';
import { AnalyzeRequestDto } from './dto/ai-agent.dto';

type TemplateWithStages = Awaited<ReturnType<AiAgentService['loadTemplates']>>[number];

/**
 * ИИ-агент: понимает свободный запрос пользователя, подбирает шаблон и
 * считает две оценки — «по этапам» (через платформу) и «под ключ».
 *
 * Принцип проекта: ИИ только понимает запрос и извлекает параметры.
 * Все суммы и количества считаются формулами и прайсами БД (read-only,
 * без создания проекта). Регистрация не требуется — публичный расчёт.
 */
@Injectable()
export class AiAgentService {
  private readonly logger = new Logger(AiAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly formulas: FormulasService,
    private readonly aiSettings: AiSettingsService,
  ) {}

  async analyze(dto: AnalyzeRequestDto): Promise<AiAnalyzeResult> {
    const templates = await this.loadTemplates();
    const region = dto.regionCode
      ? await this.prisma.region.findUnique({ where: { code: dto.regionCode } })
      : null;

    const ai = await this.aiSettings.getProvider();
    const understanding = await ai.understand({
      query: dto.query,
      regionName: region?.name,
      templates: templates.map((t) => this.toContext(t)),
    });

    const base: AiAnalyzeResult = {
      query: dto.query.trim(),
      summary: understanding.summary,
      source: understanding.source,
      matched: false,
      confidence: understanding.confidence,
      template: null,
      parameters: understanding.parameters,
      missingParameters: [],
      proposedStages: understanding.proposedStages,
      stages: [],
      pricing: null,
      aiEstimate: null,
      whyCheaper: null,
      cta: null,
    };

    const matched = understanding.matchedSlug
      ? templates.find((t) => t.slug === understanding.matchedSlug)
      : undefined;

    // 1) Есть готовый сценарий в БД — точный расчёт формулами/прайсами.
    if (matched) {
      const { stages, missingParameters, pricing } = await this.estimate(
        matched,
        understanding.parameters,
        region,
      );
      return {
        ...base,
        matched: true,
        template: { slug: matched.slug, name: matched.name, description: matched.description ?? undefined },
        missingParameters,
        proposedStages: [],
        stages,
        pricing,
        whyCheaper: pricing ? this.whyCheaperText(pricing.savings, pricing.savingsPercent) : null,
        cta: { templateSlug: matched.slug },
      };
    }

    // 2) Готового сценария нет, но ИИ дал ориентировочную оценку с диапазонами.
    if (understanding.estimate && understanding.estimate.stages.length > 0) {
      const e = understanding.estimate;
      const savingsMin = Math.max(0, Math.round(e.turnkeyMin - e.stagedMax));
      const savingsMax = Math.max(0, Math.round(e.turnkeyMax - e.stagedMin));
      return {
        ...base,
        proposedStages: [],
        aiEstimate: {
          stages: e.stages,
          stagedMin: Math.round(e.stagedMin),
          stagedMax: Math.round(e.stagedMax),
          turnkeyMin: Math.round(e.turnkeyMin),
          turnkeyMax: Math.round(e.turnkeyMax),
          savingsMin,
          savingsMax,
          whyCheaper: e.whyCheaper,
          assumptions: e.assumptions,
          currency: 'RUB',
        },
        whyCheaper: e.whyCheaper,
      };
    }

    // 3) Ничего не вышло — только текстовые предложения этапов.
    return base;
  }

  private whyCheaperText(savings: number, percent: number): string {
    const base =
      'Заказывая каждый этап напрямую — работы у исполнителей, материалы у поставщиков, технику у перевозчиков — вы не платите наценку генподрядчика за «под ключ» и сравниваете предложения между собой.';
    if (savings > 0) {
      return `${base} По расчёту экономия — около ${savings.toLocaleString('ru-RU')} ₽ (${percent}%).`;
    }
    return base;
  }

  private loadTemplates() {
    return this.prisma.projectTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        questionnaire: { include: { questions: true } },
        stageTemplates: {
          orderBy: { order: 'asc' },
          include: {
            materials: { include: { material: true, quantityFormula: true } },
            specialists: { include: { specialist: true } },
            equipment: { include: { equipment: true } },
          },
        },
      },
    });
  }

  /** Контекст шаблона для понимания: параметры (variableKey) и ключевые слова. */
  private toContext(t: TemplateWithStages): AiTemplateContext {
    const params = new Map<string, { key: string; label: string; unit?: string }>();
    for (const q of t.questionnaire?.questions ?? []) {
      if (q.variableKey && !params.has(q.variableKey)) {
        params.set(q.variableKey, { key: q.variableKey, label: q.label, unit: q.unit ?? undefined });
      }
    }
    const keywords = Array.from(
      new Set(
        `${t.name} ${t.description ?? ''}`
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 4),
      ),
    );
    return {
      slug: t.slug,
      name: t.name,
      description: t.description ?? undefined,
      workType: t.workType,
      parameters: Array.from(params.values()),
      keywords,
    };
  }

  /** Read-only расчёт сметы по шаблону: материалы — формулами, работы — по ориентирам. */
  private async estimate(
    template: TemplateWithStages,
    parameters: Record<string, number>,
    region: { id: string; priceFactor: unknown } | null,
  ): Promise<{
    stages: AiAnalyzeStage[];
    missingParameters: { key: string; label: string; unit?: string }[];
    pricing: AiAnalyzeResult['pricing'];
  }> {
    const regionFactor = region ? Number(region.priceFactor) : 1;
    const regionId = region?.id ?? null;
    const stages: AiAnalyzeStage[] = [];
    let subtotal = 0;

    for (const st of template.stageTemplates) {
      let materialsCost = 0;
      let needsInput = false;

      for (const link of st.materials) {
        let quantity = link.fixedQuantity ? Number(link.fixedQuantity) : 0;
        if (link.quantityFormula) {
          try {
            const { trace } = await this.formulas.evalByKey(
              link.quantityFormula.key,
              parameters,
              regionFactor,
            );
            quantity = trace.final;
          } catch {
            // Не хватает параметров — материал уточнится в анкете проекта.
            needsInput = true;
            quantity = 0;
          }
        }
        const unitPrice = await this.resolveMaterialPrice(link.materialId, regionId, regionFactor);
        materialsCost += quantity * unitPrice;
      }

      const days = Number(st.estimatedDays);
      let worksCost = 0;
      for (const sp of st.specialists) {
        const rate = sp.specialist.dayRateHint ? Number(sp.specialist.dayRateHint) : 0;
        worksCost += rate * days * sp.count * regionFactor;
      }
      for (const eq of st.equipment) {
        const rate = eq.equipment.rateHint ? Number(eq.equipment.rateHint) : 0;
        worksCost += rate * days * eq.count * regionFactor;
      }

      materialsCost = Number(materialsCost.toFixed(2));
      worksCost = Number(worksCost.toFixed(2));
      const total = Number((materialsCost + worksCost).toFixed(2));
      subtotal += total;

      stages.push({
        code: st.code,
        order: st.order,
        name: st.name,
        workType: st.workType,
        estimatedDays: days,
        materialsCost,
        worksCost,
        total,
        needsInput,
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    const commission = await this.resolveCommission(subtotal);
    const turnkeyMultiplier = await this.getTurnkeyMultiplier();
    const stagedTotal = Number((subtotal + commission).toFixed(2));
    const turnkeyTotal = Number((subtotal * turnkeyMultiplier).toFixed(2));
    const savings = Number(Math.max(0, turnkeyTotal - stagedTotal).toFixed(2));
    const savingsPercent = turnkeyTotal > 0 ? Number(((savings / turnkeyTotal) * 100).toFixed(1)) : 0;

    const missingParameters = this.toContext(template).parameters.filter(
      (p) => parameters[p.key] == null,
    );

    return {
      stages,
      missingParameters,
      pricing: {
        currency: 'RUB',
        subtotal,
        commission,
        stagedTotal,
        turnkeyTotal,
        savings,
        savingsPercent,
      },
    };
  }

  /** Цена материала в регионе с фолбэком на базовую цену × региональный коэффициент. */
  private async resolveMaterialPrice(
    materialId: string,
    regionId: string | null,
    regionFactor: number,
  ): Promise<number> {
    const now = new Date();
    if (regionId) {
      const regional = await this.prisma.regionalPrice.findFirst({
        where: {
          materialId,
          regionId,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gt: now } }],
        },
        orderBy: { validFrom: 'desc' },
      });
      if (regional) return Number(regional.price);
    }
    const base = await this.prisma.regionalPrice.findFirst({
      where: { materialId, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] },
      orderBy: { validFrom: 'desc' },
    });
    return base ? Number(base.price) * regionFactor : 0;
  }

  private async resolveCommission(subtotal: number): Promise<number> {
    const rule = await this.prisma.commissionRule.findFirst({
      where: { isActive: true },
      orderBy: { validFrom: 'desc' },
    });
    if (!rule) return 0;
    const value = (subtotal * Number(rule.percent)) / 100;
    return Number(Math.max(value, Number(rule.minAmount)).toFixed(2));
  }

  private async getTurnkeyMultiplier(): Promise<number> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'estimate.turnkeyMultiplier' },
    });
    const value = setting?.value as number | undefined;
    return typeof value === 'number' && value > 1 ? value : 1.5;
  }
}

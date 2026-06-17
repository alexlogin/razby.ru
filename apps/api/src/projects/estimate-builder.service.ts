import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type StageStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FormulasService } from '../formulas/formulas.service';
import { NotificationsService } from '../notifications/notifications.service';

interface BuildResult {
  estimateId: string;
  total: number;
  materialsCost: number;
  worksCost: number;
  logisticsCost: number;
}

/**
 * Строит этапы проекта из шаблона, считает материалы формулами,
 * фиксирует региональные цены и формирует смету с историей версий.
 * Все числа — из формул и прайсов БД, никакой генерации ИИ.
 */
@Injectable()
export class EstimateBuilderService {
  private readonly logger = new Logger(EstimateBuilderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly formulas: FormulasService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Цена материала в регионе на текущий момент с фолбэком на базовую цену * региональный коэффициент. */
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

  /** Собирает входные значения формул из ответов анкеты (по variableKey вопроса). */
  private async collectFormulaInputs(projectId: string, templateId: string | null): Promise<Record<string, number>> {
    const inputs: Record<string, number> = {};
    if (!templateId) return inputs;

    const questionnaire = await this.prisma.questionnaire.findUnique({
      where: { templateId },
      include: { questions: true },
    });
    if (!questionnaire) return inputs;

    const answers = await this.prisma.projectAnswer.findMany({ where: { projectId } });
    const answerByCode = new Map(answers.map((a) => [a.questionCode, a.value]));

    for (const q of questionnaire.questions) {
      if (!q.variableKey) continue;
      const raw = answerByCode.get(q.code);
      if (raw == null) continue;
      const num = this.coerceNumber(raw);
      if (num != null) inputs[q.variableKey] = num;
    }
    return inputs;
  }

  private coerceNumber(value: Prisma.JsonValue): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') {
      const n = Number(value.replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      // объём/размеры: { value } или { length,width,height }
      if (typeof obj.value === 'number') return obj.value;
    }
    return null;
  }

  /**
   * Полный пересчёт проекта: этапы, материалы, смета.
   * Идемпотентен — пересоздаёт этапы из шаблона при первом расчёте,
   * далее только обновляет материалы и смету.
   */
  async rebuild(projectId: string): Promise<BuildResult> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { region: true },
    });
    const regionFactor = project.region ? Number(project.region.priceFactor) : 1;

    await this.ensureStages(projectId, project.templateId);
    const inputs = await this.collectFormulaInputs(projectId, project.templateId);

    const stages = await this.prisma.projectStage.findMany({
      where: { projectId },
      include: { stageTemplate: { include: { materials: true, specialists: true, equipment: true } } },
      orderBy: { order: 'asc' },
    });

    let materialsCost = 0;
    let worksCost = 0;
    const logisticsCost = 0;
    const estimateItems: Prisma.EstimateItemCreateManyEstimateInput[] = [];

    for (const stage of stages) {
      const tpl = stage.stageTemplate;
      if (!tpl) continue;
      let stageMaterialsCost = 0;

      // Материалы этапа
      for (const link of tpl.materials) {
        let quantity = link.fixedQuantity ? Number(link.fixedQuantity) : 0;
        let formulaKey: string | null = null;
        let formulaVersion: number | null = null;
        let calcTrace: Prisma.InputJsonValue | undefined;

        if (link.quantityFormulaId) {
          const formula = await this.prisma.formula.findUnique({
            where: { id: link.quantityFormulaId },
          });
          if (formula) {
            const { trace, version } = await this.formulas.evalByKey(formula.key, inputs, regionFactor);
            quantity = trace.final;
            formulaKey = formula.key;
            formulaVersion = version;
            calcTrace = trace as unknown as Prisma.InputJsonValue;
          }
        }

        const material = await this.prisma.material.findUniqueOrThrow({ where: { id: link.materialId } });
        const unitPrice = await this.resolveMaterialPrice(material.id, project.regionId, regionFactor);
        const totalPrice = Number((quantity * unitPrice).toFixed(2));
        stageMaterialsCost += totalPrice;

        await this.prisma.projectStageMaterial.upsert({
          where: { stageId_materialId: { stageId: stage.id, materialId: material.id } },
          create: {
            stageId: stage.id,
            materialId: material.id,
            quantity,
            unit: material.unit,
            unitPrice,
            totalPrice,
            formulaKey,
            formulaVersion,
            calcTrace,
          },
          update: { quantity, unit: material.unit, unitPrice, totalPrice, formulaKey, formulaVersion, calcTrace },
        });

        estimateItems.push({
          stageCode: stage.code,
          kind: 'MATERIAL',
          title: `${stage.name}: ${material.name}`,
          unit: material.unit,
          quantity: new Prisma.Decimal(quantity),
          unitPrice: new Prisma.Decimal(unitPrice),
          total: new Prisma.Decimal(totalPrice),
          meta: { materialId: material.id, formulaKey, formulaVersion },
        });
      }

      // Первичная оценка работ по ориентирам специалистов/техники (заменяется офферами)
      let stageWorksCost = 0;
      for (const sp of tpl.specialists) {
        const spec = await this.prisma.specialist.findUniqueOrThrow({ where: { id: sp.specialistId } });
        const rate = spec.dayRateHint ? Number(spec.dayRateHint) : 0;
        stageWorksCost += rate * Number(tpl.estimatedDays) * sp.count * regionFactor;
      }
      for (const eq of tpl.equipment) {
        const equip = await this.prisma.equipment.findUniqueOrThrow({ where: { id: eq.equipmentId } });
        const rate = equip.rateHint ? Number(equip.rateHint) : 0;
        stageWorksCost += rate * Number(tpl.estimatedDays) * eq.count * regionFactor;
      }
      stageWorksCost = Number(stageWorksCost.toFixed(2));

      if (stageWorksCost > 0) {
        estimateItems.push({
          stageCode: stage.code,
          kind: 'WORK',
          title: `${stage.name}: работы (оценка)`,
          unit: 'этап',
          quantity: new Prisma.Decimal(1),
          unitPrice: new Prisma.Decimal(stageWorksCost),
          total: new Prisma.Decimal(stageWorksCost),
          meta: { estimate: true },
        });
      }

      materialsCost += stageMaterialsCost;
      worksCost += stageWorksCost;

      // Зафиксировать оценочную стоимость этапа (если ещё нет фактической из оффера)
      await this.prisma.projectStage.update({
        where: { id: stage.id },
        data: { estimatedCost: new Prisma.Decimal(Number((stageMaterialsCost + stageWorksCost).toFixed(2))) },
      });
    }

    materialsCost = Number(materialsCost.toFixed(2));
    worksCost = Number(worksCost.toFixed(2));

    const subtotal = materialsCost + worksCost + logisticsCost;
    const commission = await this.resolveCommission(subtotal, project.templateId);
    const turnkeyMultiplier = await this.getTurnkeyMultiplier();
    const total = Number((subtotal + commission).toFixed(2));
    const turnkeyTotal = Number((subtotal * turnkeyMultiplier).toFixed(2));

    if (commission > 0) {
      estimateItems.push({
        kind: 'COMMISSION',
        title: 'Комиссия платформы',
        unit: '%',
        quantity: new Prisma.Decimal(1),
        unitPrice: new Prisma.Decimal(commission),
        total: new Prisma.Decimal(commission),
      });
    }

    // Новая версия сметы (история сохраняется)
    const estimate = await this.prisma.$transaction(async (tx) => {
      const last = await tx.estimate.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
      });
      await tx.estimate.updateMany({ where: { projectId, isCurrent: true }, data: { isCurrent: false } });
      return tx.estimate.create({
        data: {
          projectId,
          version: (last?.version ?? 0) + 1,
          isCurrent: true,
          materialsCost: new Prisma.Decimal(materialsCost),
          worksCost: new Prisma.Decimal(worksCost),
          logisticsCost: new Prisma.Decimal(logisticsCost),
          commission: new Prisma.Decimal(commission),
          total: new Prisma.Decimal(total),
          turnkeyTotal: new Prisma.Decimal(turnkeyTotal),
          items: { createMany: { data: estimateItems } },
        },
      });
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'ESTIMATED' },
    });

    this.logger.log(`Смета проекта ${projectId} пересчитана: ${total} ₽ (v${estimate.version})`);

    await this.notifications.notify({
      userId: project.customerId,
      type: 'PROJECT' as any,
      projectId,
      title: 'Смета рассчитана',
      body: `Предварительная стоимость проекта: ${total.toLocaleString('ru-RU')} ₽`,
    });

    return { estimateId: estimate.id, total, materialsCost, worksCost, logisticsCost };
  }

  /** Создаёт этапы проекта из шаблона при первом расчёте. */
  private async ensureStages(projectId: string, templateId: string | null): Promise<void> {
    if (!templateId) return;
    const existing = await this.prisma.projectStage.count({ where: { projectId } });
    if (existing > 0) return;

    const stageTemplates = await this.prisma.stageTemplate.findMany({
      where: { templateId },
      include: { dependsOn: true },
      orderBy: { order: 'asc' },
    });

    // Создаём этапы
    const codeToId = new Map<string, string>();
    for (const st of stageTemplates) {
      const created = await this.prisma.projectStage.create({
        data: {
          projectId,
          stageTemplateId: st.id,
          code: st.code,
          order: st.order,
          name: st.name,
          description: st.description,
          workType: st.workType,
          estimatedDays: st.estimatedDays,
          status: 'BLOCKED' as StageStatus,
          checklistState: st.checklist as Prisma.InputJsonValue,
        },
      });
      codeToId.set(st.code, created.id);
    }

    // Переносим зависимости
    const tplCodeById = new Map(stageTemplates.map((s) => [s.id, s.code]));
    for (const st of stageTemplates) {
      for (const dep of st.dependsOn) {
        const requiresCode = tplCodeById.get(dep.requiresId);
        const stageId = codeToId.get(st.code);
        const requiresId = requiresCode ? codeToId.get(requiresCode) : undefined;
        if (stageId && requiresId) {
          await this.prisma.projectStageDependency.create({
            data: { stageId, requiresId, type: dep.type },
          });
        }
      }
    }

    // Этапы без зависимостей переводим в PENDING
    for (const st of stageTemplates) {
      if (st.dependsOn.length === 0) {
        const id = codeToId.get(st.code);
        if (id) await this.prisma.projectStage.update({ where: { id }, data: { status: 'PENDING' } });
      }
    }
  }

  private async resolveCommission(subtotal: number, _templateId: string | null): Promise<number> {
    const rule = await this.prisma.commissionRule.findFirst({
      where: { isActive: true },
      orderBy: { validFrom: 'desc' },
    });
    if (!rule) return 0;
    const value = (subtotal * Number(rule.percent)) / 100;
    return Number(Math.max(value, Number(rule.minAmount)).toFixed(2));
  }

  private async getTurnkeyMultiplier(): Promise<number> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'estimate.turnkeyMultiplier' } });
    const value = setting?.value as number | undefined;
    return typeof value === 'number' && value > 1 ? value : 1.5;
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FormulaEvalService,
  type EvalTrace,
  type FormulaVariableDef,
} from './formula-eval.service';
import { AuditService } from '../audit/audit.service';
import { CreateFormulaDto, CreateFormulaVersionDto } from './dto/formula.dto';

@Injectable()
export class FormulasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluator: FormulaEvalService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.formula.findMany({
      include: { versions: { orderBy: { version: 'desc' } } },
      orderBy: { key: 'asc' },
    });
  }

  async getByKey(key: string) {
    const formula = await this.prisma.formula.findUnique({
      where: { key },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!formula) throw new NotFoundException(`Формула "${key}" не найдена`);
    return formula;
  }

  /** Активная версия формулы на момент времени (по validFrom/validTo). */
  async getActiveVersion(key: string, at: Date = new Date()) {
    const formula = await this.prisma.formula.findUnique({ where: { key } });
    if (!formula || !formula.isActive) {
      throw new NotFoundException(`Активная формула "${key}" не найдена`);
    }
    const version = await this.prisma.formulaVersion.findFirst({
      where: {
        formulaId: formula.id,
        validFrom: { lte: at },
        OR: [{ validTo: null }, { validTo: { gt: at } }],
      },
      orderBy: { version: 'desc' },
    });
    if (!version) throw new NotFoundException(`Нет действующей версии формулы "${key}"`);
    return { formula, version };
  }

  /** Вычисление по ключу формулы: резолвит активную версию и считает. */
  async evalByKey(
    key: string,
    inputs: Record<string, number>,
    regionFactor = 1,
  ): Promise<{ trace: EvalTrace; version: number; unit: string }> {
    const { formula, version } = await this.getActiveVersion(key);
    const trace = this.evaluator.evaluate({
      expression: version.expression,
      variables: (version.variables as unknown as FormulaVariableDef[]) ?? [],
      inputs,
      minValue: FormulaEvalService.dec(version.minValue),
      maxValue: FormulaEvalService.dec(version.maxValue),
      rounding: version.rounding,
      roundingStep: Number(version.roundingStep),
      safetyFactor: Number(version.safetyFactor),
      regionFactor,
      regionFactorOn: version.regionFactorOn,
    });
    return { trace: { ...trace, unit: formula.unit }, version: version.version, unit: formula.unit };
  }

  async create(dto: CreateFormulaDto, actorId: string) {
    const formula = await this.prisma.formula.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        unit: dto.unit,
        versions: {
          create: {
            version: 1,
            expression: dto.expression,
            variables: dto.variables as any,
            minValue: dto.minValue,
            maxValue: dto.maxValue,
            rounding: dto.rounding ?? 'NEAREST',
            roundingStep: dto.roundingStep ?? 1,
            safetyFactor: dto.safetyFactor ?? 1,
            regionFactorOn: dto.regionFactorOn ?? false,
            authorId: actorId,
            changeNote: 'Создание формулы',
          },
        },
      },
      include: { versions: true },
    });
    await this.audit.log({
      actorId,
      action: 'formula.create',
      entityType: 'Formula',
      entityId: formula.id,
      after: formula,
    });
    return formula;
  }

  /** Новая версия формулы. Предыдущая активная закрывается датой validTo. */
  async addVersion(key: string, dto: CreateFormulaVersionDto, actorId: string) {
    const formula = await this.prisma.formula.findUnique({
      where: { key },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!formula) throw new NotFoundException(`Формула "${key}" не найдена`);

    const validFrom = dto.validFrom ? new Date(dto.validFrom) : new Date();
    const nextVersion = (formula.versions[0]?.version ?? 0) + 1;

    const result = await this.prisma.$transaction(async (tx) => {
      // Закрываем текущую открытую версию
      await tx.formulaVersion.updateMany({
        where: { formulaId: formula.id, validTo: null, validFrom: { lt: validFrom } },
        data: { validTo: validFrom },
      });
      return tx.formulaVersion.create({
        data: {
          formulaId: formula.id,
          version: nextVersion,
          expression: dto.expression,
          variables: dto.variables as any,
          minValue: dto.minValue,
          maxValue: dto.maxValue,
          rounding: dto.rounding ?? 'NEAREST',
          roundingStep: dto.roundingStep ?? 1,
          safetyFactor: dto.safetyFactor ?? 1,
          regionFactorOn: dto.regionFactorOn ?? false,
          validFrom,
          authorId: actorId,
          changeNote: dto.changeNote,
        },
      });
    });

    await this.audit.log({
      actorId,
      action: 'formula.version.create',
      entityType: 'FormulaVersion',
      entityId: result.id,
      after: result,
    });
    return result;
  }

  /** Проверка формулы на тестовых входах без сохранения. */
  async dryRun(key: string, inputs: Record<string, number>, regionFactor = 1) {
    if (!inputs || typeof inputs !== 'object') {
      throw new BadRequestException('Нужны входные значения inputs');
    }
    return this.evalByKey(key, inputs, regionFactor);
  }
}

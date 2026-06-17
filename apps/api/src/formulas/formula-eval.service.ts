import { BadRequestException, Injectable } from '@nestjs/common';
import { Parser } from 'expr-eval';
import { Prisma } from '@prisma/client';

export interface FormulaVariableDef {
  key: string;
  label?: string;
  unit?: string;
  source?: string; // например, код вопроса анкеты
  default?: number;
}

export interface EvalInput {
  expression: string;
  variables: FormulaVariableDef[];
  inputs: Record<string, number>;
  minValue?: number | null;
  maxValue?: number | null;
  rounding?: 'NONE' | 'UP' | 'DOWN' | 'NEAREST';
  roundingStep?: number;
  safetyFactor?: number;
  regionFactor?: number; // применяется, если regionFactorOn
  regionFactorOn?: boolean;
}

export interface EvalTrace {
  inputs: Record<string, number>;
  raw: number; // результат выражения
  afterSafety: number;
  afterRegion: number;
  final: number; // после min/max и округления
  unit?: string;
}

/**
 * Детерминированное вычисление формул.
 * Никакой ИИ и случайность: только выражение + входные числа + коэффициенты.
 */
@Injectable()
export class FormulaEvalService {
  private readonly parser = new Parser({
    operators: {
      add: true,
      subtract: true,
      multiply: true,
      divide: true,
      power: true,
      remainder: true,
      conditional: true,
      comparison: true,
      logical: true,
    },
  });

  evaluate(input: EvalInput): EvalTrace {
    const scope: Record<string, number> = {};
    for (const v of input.variables) {
      const provided = input.inputs[v.key];
      const value = provided ?? v.default;
      if (value === undefined || value === null || Number.isNaN(Number(value))) {
        throw new BadRequestException(
          `Не задана переменная "${v.key}"${v.label ? ` (${v.label})` : ''} для расчёта`,
        );
      }
      scope[v.key] = Number(value);
    }

    let raw: number;
    try {
      const expr = this.parser.parse(input.expression);
      raw = Number(expr.evaluate(scope));
    } catch (e) {
      throw new BadRequestException(`Ошибка вычисления формулы: ${(e as Error).message}`);
    }
    if (!Number.isFinite(raw)) {
      throw new BadRequestException('Формула дала недопустимый результат');
    }

    const safety = input.safetyFactor ?? 1;
    const afterSafety = raw * safety;

    const regionOn = input.regionFactorOn ?? false;
    const regionFactor = regionOn ? (input.regionFactor ?? 1) : 1;
    const afterRegion = afterSafety * regionFactor;

    let bounded = afterRegion;
    if (input.minValue != null) bounded = Math.max(bounded, input.minValue);
    if (input.maxValue != null) bounded = Math.min(bounded, input.maxValue);

    const final = this.round(bounded, input.rounding ?? 'NEAREST', input.roundingStep ?? 1);

    return {
      inputs: scope,
      raw,
      afterSafety,
      afterRegion,
      final,
    };
  }

  private round(value: number, mode: 'NONE' | 'UP' | 'DOWN' | 'NEAREST', step: number): number {
    if (mode === 'NONE' || step <= 0) return value;
    const n = value / step;
    let rounded: number;
    switch (mode) {
      case 'UP':
        rounded = Math.ceil(n);
        break;
      case 'DOWN':
        rounded = Math.floor(n);
        break;
      default:
        rounded = Math.round(n);
    }
    return Number((rounded * step).toFixed(4));
  }

  /** Преобразование Decimal | null из Prisma в number | null. */
  static dec(value: Prisma.Decimal | null | undefined): number | null {
    return value == null ? null : Number(value);
  }
}

import { BadRequestException } from '@nestjs/common';
import { FormulaEvalService } from './formula-eval.service';

describe('FormulaEvalService (движок расчётов)', () => {
  const service = new FormulaEvalService();

  it('считает объём котлована детерминированно', () => {
    const trace = service.evaluate({
      expression: '(cellar_length + 1) * (cellar_width + 1) * (cellar_height + 0.4)',
      variables: [
        { key: 'cellar_length' },
        { key: 'cellar_width' },
        { key: 'cellar_height' },
      ],
      inputs: { cellar_length: 3, cellar_width: 2.5, cellar_height: 2.3 },
      rounding: 'NONE',
    });
    // (4)*(3.5)*(2.7) = 37.8
    expect(trace.raw).toBeCloseTo(37.8, 5);
    expect(trace.final).toBeCloseTo(37.8, 5);
  });

  it('применяет коэффициент запаса и округление вверх по шагу', () => {
    const trace = service.evaluate({
      expression: '(cellar_length + 1) * (cellar_width + 1) * 0.2',
      variables: [{ key: 'cellar_length' }, { key: 'cellar_width' }],
      inputs: { cellar_length: 3, cellar_width: 2.5 },
      safetyFactor: 1.1,
      rounding: 'UP',
      roundingStep: 0.5,
    });
    // raw=2.8, *1.1=3.08 → вверх до 0.5 → 3.5
    expect(trace.raw).toBeCloseTo(2.8, 5);
    expect(trace.afterSafety).toBeCloseTo(3.08, 5);
    expect(trace.final).toBe(3.5);
  });

  it('применяет региональный коэффициент только при включённом флаге', () => {
    const base = {
      expression: 'x * 100',
      variables: [{ key: 'x' }],
      inputs: { x: 2 },
      regionFactor: 1.5,
      rounding: 'NONE' as const,
    };
    expect(service.evaluate({ ...base, regionFactorOn: false }).final).toBe(200);
    expect(service.evaluate({ ...base, regionFactorOn: true }).final).toBe(300);
  });

  it('соблюдает минимальное и максимальное значение', () => {
    const trace = service.evaluate({
      expression: 'x',
      variables: [{ key: 'x' }],
      inputs: { x: -5 },
      minValue: 0,
      rounding: 'NONE',
    });
    expect(trace.final).toBe(0);
  });

  it('бросает ошибку при отсутствии переменной', () => {
    expect(() =>
      service.evaluate({
        expression: 'a + b',
        variables: [{ key: 'a' }, { key: 'b', label: 'Б' }],
        inputs: { a: 1 },
      }),
    ).toThrow(BadRequestException);
  });

  it('не выполняет произвольный код (безопасное выражение)', () => {
    expect(() =>
      service.evaluate({
        expression: 'process.exit(1)',
        variables: [],
        inputs: {},
      }),
    ).toThrow();
  });
});

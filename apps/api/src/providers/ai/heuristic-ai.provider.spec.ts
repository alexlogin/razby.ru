import { HeuristicAiProvider } from './heuristic-ai.provider';
import type { AiTemplateContext } from './ai.provider';

describe('HeuristicAiProvider', () => {
  const provider = new HeuristicAiProvider();
  const cellar: AiTemplateContext = {
    slug: 'plastic-cellar',
    name: 'Монтаж пластикового погреба',
    description: 'Установка погреба под ключ',
    workType: 'INSTALLATION',
    parameters: [
      { key: 'cellar_length', label: 'Длина погреба', unit: 'м' },
      { key: 'cellar_width', label: 'Ширина погреба', unit: 'м' },
      { key: 'cellar_height', label: 'Высота погреба', unit: 'м' },
    ],
    keywords: ['погреб', 'монтаж', 'установка'],
  };

  it('подбирает шаблон по корню слова («погреб» ≈ «погреба»)', async () => {
    const r = await provider.understand({ query: 'Нужен монтаж погреба', templates: [cellar] });
    expect(r.matchedSlug).toBe('plastic-cellar');
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.source).toBe('heuristic');
  });

  it('извлекает габариты из формата 3x2x2', async () => {
    const r = await provider.understand({ query: 'Монтаж погреба 3x2x2', templates: [cellar] });
    expect(r.parameters).toEqual({ cellar_length: 3, cellar_width: 2, cellar_height: 2 });
  });

  it('извлекает именованные габариты и десятичные значения', async () => {
    const r = await provider.understand({
      query: 'погреб длина 4 ширина 2.5 высота 2',
      templates: [cellar],
    });
    expect(r.parameters).toEqual({ cellar_length: 4, cellar_width: 2.5, cellar_height: 2 });
  });

  it('возвращает предложенные этапы, если шаблон не найден', async () => {
    const r = await provider.understand({
      query: 'построить космический корабль',
      templates: [cellar],
    });
    expect(r.matchedSlug).toBeNull();
    expect(r.proposedStages.length).toBeGreaterThan(0);
  });
});

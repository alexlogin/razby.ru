/**
 * Данные для наполнения БД. Вынесены отдельно от логики seed.ts.
 * Все числовые значения считаются формулами — здесь только их определения и прайсы.
 */

export interface FormulaDef {
  key: string;
  name: string;
  description: string;
  unit: string;
  expression: string;
  variables: { key: string; label: string; unit: string }[];
  safetyFactor?: number;
  rounding?: 'NONE' | 'UP' | 'DOWN' | 'NEAREST';
  roundingStep?: number;
  minValue?: number;
  regionFactorOn?: boolean;
}

// Геометрия котлована: припуск рабочего пространства 0.5 м с каждой стороны (+1 м к стороне),
// запас по глубине 0.4 м (0.2 песок + 0.2 ж/б плита).
export const FORMULAS: FormulaDef[] = [
  {
    key: 'excavation_volume',
    name: 'Объём котлована',
    description: 'Объём выемки грунта под погреб с рабочими припусками',
    unit: 'м3',
    expression: '(cellar_length + 1) * (cellar_width + 1) * (cellar_height + 0.4)',
    variables: [
      { key: 'cellar_length', label: 'Длина погреба', unit: 'м' },
      { key: 'cellar_width', label: 'Ширина погреба', unit: 'м' },
      { key: 'cellar_height', label: 'Высота погреба', unit: 'м' },
    ],
    safetyFactor: 1.05,
    rounding: 'NEAREST',
    roundingStep: 0.1,
  },
  {
    key: 'soil_removal_volume',
    name: 'Объём вывоза грунта',
    description: 'Объём грунта с учётом разрыхления (коэффициент 1.2)',
    unit: 'м3',
    expression: '(cellar_length + 1) * (cellar_width + 1) * (cellar_height + 0.4) * 1.2',
    variables: [
      { key: 'cellar_length', label: 'Длина погреба', unit: 'м' },
      { key: 'cellar_width', label: 'Ширина погреба', unit: 'м' },
      { key: 'cellar_height', label: 'Высота погреба', unit: 'м' },
    ],
    rounding: 'UP',
    roundingStep: 0.5,
  },
  {
    key: 'sand_base_volume',
    name: 'Объём песчаной подушки',
    description: 'Песок основания, слой 0.2 м по дну котлована',
    unit: 'м3',
    expression: '(cellar_length + 1) * (cellar_width + 1) * 0.2',
    variables: [
      { key: 'cellar_length', label: 'Длина погреба', unit: 'м' },
      { key: 'cellar_width', label: 'Ширина погреба', unit: 'м' },
    ],
    safetyFactor: 1.1,
    rounding: 'UP',
    roundingStep: 0.5,
  },
  {
    key: 'gravel_base_volume',
    name: 'Объём щебёночной подготовки',
    description: 'Щебень основания, слой 0.1 м',
    unit: 'м3',
    expression: '(cellar_length + 1) * (cellar_width + 1) * 0.1',
    variables: [
      { key: 'cellar_length', label: 'Длина погреба', unit: 'м' },
      { key: 'cellar_width', label: 'Ширина погреба', unit: 'м' },
    ],
    safetyFactor: 1.1,
    rounding: 'UP',
    roundingStep: 0.5,
  },
  {
    key: 'concrete_slab_volume',
    name: 'Объём бетона якорной плиты',
    description: 'Бетон фундаментной (якорной) плиты, толщина 0.2 м',
    unit: 'м3',
    expression: '(cellar_length + 1) * (cellar_width + 1) * 0.2',
    variables: [
      { key: 'cellar_length', label: 'Длина погреба', unit: 'м' },
      { key: 'cellar_width', label: 'Ширина погреба', unit: 'м' },
    ],
    safetyFactor: 1.05,
    rounding: 'UP',
    roundingStep: 0.25,
  },
  {
    key: 'rebar_weight',
    name: 'Масса арматуры',
    description: 'Двойная сетка плиты, расход ~8 кг/м²',
    unit: 'кг',
    expression: '(cellar_length + 1) * (cellar_width + 1) * 8',
    variables: [
      { key: 'cellar_length', label: 'Длина погреба', unit: 'м' },
      { key: 'cellar_width', label: 'Ширина погреба', unit: 'м' },
    ],
    safetyFactor: 1.1,
    rounding: 'UP',
    roundingStep: 1,
  },
  {
    key: 'formwork_area',
    name: 'Площадь опалубки',
    description: 'Опалубка по периметру плиты высотой 0.3 м',
    unit: 'м2',
    expression: '((cellar_length + 1) + (cellar_width + 1)) * 2 * 0.3',
    variables: [
      { key: 'cellar_length', label: 'Длина погреба', unit: 'м' },
      { key: 'cellar_width', label: 'Ширина погреба', unit: 'м' },
    ],
    safetyFactor: 1.15,
    rounding: 'UP',
    roundingStep: 0.5,
  },
  {
    key: 'backfill_volume',
    name: 'Объём обратной засыпки',
    description: 'Объём пазух котлована за вычетом погреба',
    unit: 'м3',
    expression:
      '((cellar_length + 1) * (cellar_width + 1) * (cellar_height + 0.4)) - (cellar_length * cellar_width * cellar_height)',
    variables: [
      { key: 'cellar_length', label: 'Длина погреба', unit: 'м' },
      { key: 'cellar_width', label: 'Ширина погреба', unit: 'м' },
      { key: 'cellar_height', label: 'Высота погреба', unit: 'м' },
    ],
    safetyFactor: 1.1,
    rounding: 'UP',
    roundingStep: 0.5,
    minValue: 0,
  },
];

export interface MaterialDef {
  sku: string;
  name: string;
  unit: string;
  categoryCode: string;
  basePrice: number; // базовая цена (регион Москва), ₽
}

export const MATERIAL_CATEGORIES = [
  { code: 'inert', name: 'Инертные материалы' },
  { code: 'concrete', name: 'Бетон и растворы' },
  { code: 'metal', name: 'Металлопрокат' },
  { code: 'lumber', name: 'Пиломатериалы' },
  { code: 'cellar', name: 'Погреба и ёмкости' },
  { code: 'electrical', name: 'Электрика' },
  { code: 'ventilation', name: 'Вентиляция' },
];

export const MATERIALS: MaterialDef[] = [
  { sku: 'SAND-01', name: 'Песок карьерный', unit: 'м3', categoryCode: 'inert', basePrice: 1100 },
  { sku: 'GRAVEL-01', name: 'Щебень гранитный 20-40', unit: 'м3', categoryCode: 'inert', basePrice: 2200 },
  { sku: 'CONCRETE-B225', name: 'Бетон B22.5 (М300)', unit: 'м3', categoryCode: 'concrete', basePrice: 5400 },
  { sku: 'REBAR-A500-12', name: 'Арматура A500С d12', unit: 'кг', categoryCode: 'metal', basePrice: 62 },
  { sku: 'FORMWORK-BOARD', name: 'Щит опалубки (аренда/материал)', unit: 'м2', categoryCode: 'lumber', basePrice: 450 },
  { sku: 'CELLAR-PLASTIC-8', name: 'Погреб пластиковый 8 м³', unit: 'шт', categoryCode: 'cellar', basePrice: 145000 },
  { sku: 'CABLE-VVG-3x2.5', name: 'Кабель ВВГнг 3×2.5', unit: 'м.п.', categoryCode: 'electrical', basePrice: 95 },
  { sku: 'VENT-PIPE-110', name: 'Труба вентиляционная D110', unit: 'м.п.', categoryCode: 'ventilation', basePrice: 280 },
];

export const SPECIALISTS = [
  { code: 'geologist', name: 'Инженер-геолог', workType: 'ANALYSIS', dayRateHint: 6000 },
  { code: 'surveyor', name: 'Геодезист', workType: 'SURVEY', dayRateHint: 5000 },
  { code: 'digger', name: 'Землекоп', workType: 'EARTHWORK', dayRateHint: 4000 },
  { code: 'excavator_op', name: 'Машинист экскаватора', workType: 'EARTHWORK', dayRateHint: 8000 },
  { code: 'laborer', name: 'Разнорабочий', workType: 'FOUNDATION', dayRateHint: 3500 },
  { code: 'installer', name: 'Монтажник', workType: 'INSTALLATION', dayRateHint: 6000 },
  { code: 'rebar_worker', name: 'Арматурщик', workType: 'REINFORCEMENT', dayRateHint: 5500 },
  { code: 'carpenter', name: 'Плотник-опалубщик', workType: 'FORMWORK', dayRateHint: 5500 },
  { code: 'concreter', name: 'Бетонщик', workType: 'CONCRETE', dayRateHint: 5500 },
  { code: 'electrician', name: 'Электрик', workType: 'ELECTRICAL', dayRateHint: 6000 },
  { code: 'vent_installer', name: 'Монтажник вентиляции', workType: 'VENTILATION', dayRateHint: 6000 },
];

export const EQUIPMENT = [
  { code: 'excavator', name: 'Экскаватор-погрузчик', unit: 'смена', rateHint: 18000 },
  { code: 'dump_truck', name: 'Самосвал 10 м³', unit: 'рейс', rateHint: 9000 },
  { code: 'manipulator', name: 'Манипулятор (КМУ)', unit: 'смена', rateHint: 16000 },
  { code: 'concrete_mixer', name: 'Автобетоносмеситель', unit: 'рейс', rateHint: 7000 },
];

export const RISKS = [
  { code: 'groundwater', title: 'Высокие грунтовые воды', description: 'Риск всплытия погреба и подтопления котлована', severity: 4, mitigation: 'Якорная плита, дренаж, водопонижение' },
  { code: 'weak_soil', title: 'Слабый/просадочный грунт', description: 'Неравномерная осадка основания', severity: 3, mitigation: 'Усиление основания, увеличение подушки' },
  { code: 'access', title: 'Сложный подъезд техники', description: 'Невозможность подъезда экскаватора/манипулятора', severity: 2, mitigation: 'Ручная копка, иная техника, перенос места' },
  { code: 'utilities', title: 'Подземные коммуникации', description: 'Повреждение кабелей/труб при копке', severity: 4, mitigation: 'Запрос схемы коммуникаций, шурфление' },
  { code: 'frost', title: 'Промерзание/сезонность', description: 'Работы в мороз ухудшают качество бетона', severity: 2, mitigation: 'Противоморозные добавки, прогрев' },
];

// Описание этапов шаблона «Монтаж пластикового погреба».
export interface StageDef {
  code: string;
  name: string;
  description: string;
  workType: string;
  estimatedDays: number;
  dependsOn: string[];
  materials: { sku: string; formulaKey?: string; fixedQuantity?: number }[];
  specialists: { code: string; count: number }[];
  equipment: { code: string; count: number }[];
  risks: string[];
  photoRequirements: { code: string; label: string; min: number }[];
  checklist: { code: string; label: string; required: boolean }[];
  acceptanceCriteria: string[];
}

export const STAGES: StageDef[] = [
  {
    code: 'site_analysis', name: 'Анализ участка', workType: 'ANALYSIS', estimatedDays: 1,
    description: 'Оценка грунта, уровня грунтовых вод, подъездных путей и места установки погреба.',
    dependsOn: [],
    materials: [],
    specialists: [{ code: 'geologist', count: 1 }],
    equipment: [],
    risks: ['groundwater', 'weak_soil', 'utilities'],
    photoRequirements: [{ code: 'site_overview', label: 'Общий вид участка', min: 2 }],
    checklist: [
      { code: 'gw_checked', label: 'Проверен уровень грунтовых вод', required: true },
      { code: 'access_checked', label: 'Оценён подъезд техники', required: true },
    ],
    acceptanceCriteria: ['Определено место установки', 'Зафиксированы риски по грунту'],
  },
  {
    code: 'marking', name: 'Разметка', workType: 'SURVEY', estimatedDays: 1,
    description: 'Вынос контура котлована в натуру с учётом рабочих припусков.',
    dependsOn: ['site_analysis'],
    materials: [],
    specialists: [{ code: 'surveyor', count: 1 }],
    equipment: [],
    risks: ['utilities'],
    photoRequirements: [{ code: 'marking', label: 'Разметка котлована', min: 1 }],
    checklist: [{ code: 'axes', label: 'Вынесены оси и габариты', required: true }],
    acceptanceCriteria: ['Контур котлована размечен по проекту'],
  },
  {
    code: 'earthwork', name: 'Земляные работы', workType: 'EARTHWORK', estimatedDays: 1,
    description: 'Разработка котлована экскаватором с ручной доработкой дна.',
    dependsOn: ['marking'],
    materials: [],
    specialists: [{ code: 'excavator_op', count: 1 }, { code: 'digger', count: 2 }],
    equipment: [{ code: 'excavator', count: 1 }],
    risks: ['weak_soil', 'utilities', 'access'],
    photoRequirements: [{ code: 'pit', label: 'Готовый котлован', min: 2 }],
    checklist: [
      { code: 'depth', label: 'Достигнута проектная глубина', required: true },
      { code: 'bottom_level', label: 'Дно выровнено', required: true },
    ],
    acceptanceCriteria: ['Размеры котлована соответствуют разметке', 'Дно ровное и уплотнено'],
  },
  {
    code: 'soil_removal', name: 'Вывоз грунта', workType: 'LOGISTICS', estimatedDays: 1,
    description: 'Погрузка и вывоз вынутого грунта самосвалами.',
    dependsOn: ['earthwork'],
    materials: [],
    specialists: [],
    equipment: [{ code: 'dump_truck', count: 1 }],
    risks: ['access'],
    photoRequirements: [{ code: 'cleared', label: 'Участок очищен от грунта', min: 1 }],
    checklist: [{ code: 'removed', label: 'Грунт вывезен', required: true }],
    acceptanceCriteria: ['Лишний грунт вывезен с участка'],
  },
  {
    code: 'base_prep', name: 'Подготовка основания', workType: 'FOUNDATION', estimatedDays: 1,
    description: 'Устройство песчаной подушки и щебёночной подготовки, уплотнение.',
    dependsOn: ['soil_removal'],
    materials: [
      { sku: 'SAND-01', formulaKey: 'sand_base_volume' },
      { sku: 'GRAVEL-01', formulaKey: 'gravel_base_volume' },
    ],
    specialists: [{ code: 'laborer', count: 2 }],
    equipment: [],
    risks: ['weak_soil'],
    photoRequirements: [{ code: 'base', label: 'Готовое основание', min: 2 }],
    checklist: [
      { code: 'sand', label: 'Уложена и утрамбована песчаная подушка', required: true },
      { code: 'level', label: 'Основание выровнено по уровню', required: true },
    ],
    acceptanceCriteria: ['Подушка уплотнена', 'Основание горизонтально'],
  },
  {
    code: 'cellar_delivery', name: 'Доставка погреба', workType: 'LOGISTICS', estimatedDays: 1,
    description: 'Доставка пластикового погреба манипулятором на участок.',
    dependsOn: ['base_prep'],
    materials: [{ sku: 'CELLAR-PLASTIC-8', fixedQuantity: 1 }],
    specialists: [],
    equipment: [{ code: 'manipulator', count: 1 }],
    risks: ['access'],
    photoRequirements: [{ code: 'delivered', label: 'Погреб на участке', min: 1 }],
    checklist: [{ code: 'no_damage', label: 'Погреб без повреждений', required: true }],
    acceptanceCriteria: ['Погреб доставлен и осмотрен на отсутствие дефектов'],
  },
  {
    code: 'cellar_install', name: 'Установка погреба', workType: 'INSTALLATION', estimatedDays: 1,
    description: 'Опускание и выставление погреба в котлован по уровню.',
    dependsOn: ['cellar_delivery'],
    materials: [],
    specialists: [{ code: 'installer', count: 2 }],
    equipment: [{ code: 'manipulator', count: 1 }],
    risks: ['groundwater', 'access'],
    photoRequirements: [{ code: 'installed', label: 'Погреб установлен', min: 2 }],
    checklist: [
      { code: 'leveled', label: 'Погреб выставлен по уровню', required: true },
      { code: 'fixed', label: 'Зафиксирован от смещения', required: true },
    ],
    acceptanceCriteria: ['Погреб установлен по уровню', 'Положение зафиксировано'],
  },
  {
    code: 'reinforcement', name: 'Армирование', workType: 'REINFORCEMENT', estimatedDays: 1,
    description: 'Вязка арматурного каркаса якорной плиты вокруг погреба.',
    dependsOn: ['cellar_install'],
    materials: [{ sku: 'REBAR-A500-12', formulaKey: 'rebar_weight' }],
    specialists: [{ code: 'rebar_worker', count: 2 }],
    equipment: [],
    risks: ['groundwater'],
    photoRequirements: [{ code: 'rebar', label: 'Арматурный каркас', min: 2 }],
    checklist: [{ code: 'mesh', label: 'Связаны верхняя и нижняя сетки', required: true }],
    acceptanceCriteria: ['Каркас связан по проекту', 'Соблюдён защитный слой'],
  },
  {
    code: 'formwork', name: 'Опалубка', workType: 'FORMWORK', estimatedDays: 1,
    description: 'Монтаж опалубки якорной плиты по периметру.',
    dependsOn: ['reinforcement'],
    materials: [{ sku: 'FORMWORK-BOARD', formulaKey: 'formwork_area' }],
    specialists: [{ code: 'carpenter', count: 2 }],
    equipment: [],
    risks: [],
    photoRequirements: [{ code: 'formwork', label: 'Смонтированная опалубка', min: 1 }],
    checklist: [{ code: 'rigid', label: 'Опалубка раскреплена и герметична', required: true }],
    acceptanceCriteria: ['Опалубка устойчива и по размерам'],
  },
  {
    code: 'concrete_purchase', name: 'Закупка бетона', workType: 'CONCRETE', estimatedDays: 1,
    description: 'Заказ и доставка товарного бетона с завода.',
    dependsOn: ['formwork'],
    materials: [{ sku: 'CONCRETE-B225', formulaKey: 'concrete_slab_volume' }],
    specialists: [],
    equipment: [{ code: 'concrete_mixer', count: 1 }],
    risks: ['frost'],
    photoRequirements: [{ code: 'delivery_doc', label: 'Документ на бетон', min: 1 }],
    checklist: [{ code: 'grade', label: 'Марка бетона соответствует заказу', required: true }],
    acceptanceCriteria: ['Бетон нужной марки доставлен в объёме сметы'],
  },
  {
    code: 'concreting', name: 'Бетонирование', workType: 'CONCRETE', estimatedDays: 1,
    description: 'Укладка и уплотнение бетона якорной плиты, уход за бетоном.',
    dependsOn: ['concrete_purchase'],
    materials: [],
    specialists: [{ code: 'concreter', count: 2 }],
    equipment: [],
    risks: ['frost', 'groundwater'],
    photoRequirements: [{ code: 'concreted', label: 'Залитая плита', min: 2 }],
    checklist: [
      { code: 'vibrated', label: 'Бетон провибрирован', required: true },
      { code: 'cured', label: 'Обеспечен уход за бетоном', required: false },
    ],
    acceptanceCriteria: ['Плита залита без раковин', 'Поверхность заглажена'],
  },
  {
    code: 'backfill', name: 'Обратная засыпка', workType: 'BACKFILL', estimatedDays: 1,
    description: 'Послойная засыпка пазух котлована с уплотнением.',
    dependsOn: ['concreting'],
    materials: [{ sku: 'SAND-01', formulaKey: 'backfill_volume' }],
    specialists: [{ code: 'laborer', count: 2 }],
    equipment: [{ code: 'excavator', count: 1 }],
    risks: ['weak_soil'],
    photoRequirements: [{ code: 'backfilled', label: 'Засыпанный котлован', min: 1 }],
    checklist: [{ code: 'layers', label: 'Засыпка выполнена послойно', required: true }],
    acceptanceCriteria: ['Пазухи засыпаны и уплотнены'],
  },
  {
    code: 'electrical', name: 'Электрика', workType: 'ELECTRICAL', estimatedDays: 1,
    description: 'Прокладка кабеля, установка освещения и розетки в погребе.',
    dependsOn: ['backfill'],
    materials: [{ sku: 'CABLE-VVG-3x2.5', fixedQuantity: 20 }],
    specialists: [{ code: 'electrician', count: 1 }],
    equipment: [],
    risks: [],
    photoRequirements: [{ code: 'wiring', label: 'Смонтированная электрика', min: 1 }],
    checklist: [{ code: 'tested', label: 'Электрика проверена под нагрузкой', required: true }],
    acceptanceCriteria: ['Освещение и розетка работают', 'Соблюдены нормы безопасности'],
  },
  {
    code: 'ventilation', name: 'Вентиляция', workType: 'VENTILATION', estimatedDays: 1,
    description: 'Монтаж приточно-вытяжной вентиляции погреба.',
    dependsOn: ['backfill'],
    materials: [{ sku: 'VENT-PIPE-110', fixedQuantity: 6 }],
    specialists: [{ code: 'vent_installer', count: 1 }],
    equipment: [],
    risks: [],
    photoRequirements: [{ code: 'vent', label: 'Вентиляционные трубы', min: 1 }],
    checklist: [{ code: 'draft', label: 'Есть тяга в вытяжке', required: true }],
    acceptanceCriteria: ['Приток и вытяжка смонтированы', 'Обеспечена тяга'],
  },
  {
    code: 'landscaping', name: 'Планировка участка', workType: 'LANDSCAPING', estimatedDays: 1,
    description: 'Планировка грунта над погребом и вокруг, восстановление участка.',
    dependsOn: ['electrical', 'ventilation'],
    materials: [],
    specialists: [{ code: 'laborer', count: 2 }],
    equipment: [{ code: 'excavator', count: 1 }],
    risks: [],
    photoRequirements: [{ code: 'final_site', label: 'Спланированный участок', min: 2 }],
    checklist: [{ code: 'graded', label: 'Грунт спланирован с уклоном от погреба', required: true }],
    acceptanceCriteria: ['Участок спланирован', 'Обеспечен отвод воды от погреба'],
  },
  {
    code: 'final_acceptance', name: 'Финальная приёмка', workType: 'ACCEPTANCE', estimatedDays: 1,
    description: 'Итоговая проверка работ, оформление акта и передача заказчику.',
    dependsOn: ['landscaping'],
    materials: [],
    specialists: [],
    equipment: [],
    risks: [],
    photoRequirements: [{ code: 'final', label: 'Готовый объект', min: 2 }],
    checklist: [
      { code: 'walkthrough', label: 'Проведён совместный осмотр', required: true },
      { code: 'docs', label: 'Переданы документы и гарантии', required: true },
    ],
    acceptanceCriteria: ['Все этапы приняты', 'Подписан итоговый акт'],
  },
];

// Вопросы анкеты. variableKey связывает ответ с переменной формул.
export interface QuestionDef {
  code: string;
  label: string;
  hint?: string;
  type: string;
  required: boolean;
  order: number;
  variableKey?: string;
  unit?: string;
  linkedStageCode?: string;
  linkedRiskCode?: string;
  options?: { value: string; label: string }[];
  validation?: Record<string, unknown>;
  conditionalOn?: { questionCode: string; op: string; value: unknown };
}

export const QUESTIONS: QuestionDef[] = [
  { code: 'cellar_model', label: 'Модель/объём погреба', type: 'SELECT', required: true, order: 1,
    options: [
      { value: 'plastic_4', label: 'Пластиковый 4 м³' },
      { value: 'plastic_8', label: 'Пластиковый 8 м³' },
      { value: 'plastic_12', label: 'Пластиковый 12 м³' },
    ] },
  { code: 'cellar_length', label: 'Длина погреба', hint: 'Внешний габарит, м', type: 'NUMBER', required: true, order: 2, variableKey: 'cellar_length', unit: 'м', validation: { min: 1, max: 6 } },
  { code: 'cellar_width', label: 'Ширина погреба', hint: 'Внешний габарит, м', type: 'NUMBER', required: true, order: 3, variableKey: 'cellar_width', unit: 'м', validation: { min: 1, max: 6 } },
  { code: 'cellar_height', label: 'Высота погреба', hint: 'Внешний габарит, м', type: 'NUMBER', required: true, order: 4, variableKey: 'cellar_height', unit: 'м', validation: { min: 1, max: 4 } },
  { code: 'address', label: 'Адрес участка', type: 'ADDRESS', required: true, order: 5 },
  { code: 'location', label: 'Точка на карте', type: 'MAP', required: false, order: 6 },
  { code: 'soil_type', label: 'Тип грунта', type: 'SELECT', required: true, order: 7, linkedRiskCode: 'weak_soil',
    options: [
      { value: 'sand', label: 'Песок' },
      { value: 'loam', label: 'Суглинок' },
      { value: 'clay', label: 'Глина' },
      { value: 'peat', label: 'Торф/слабый грунт' },
      { value: 'unknown', label: 'Не знаю' },
    ] },
  { code: 'groundwater', label: 'Высокий уровень грунтовых вод?', type: 'BOOLEAN', required: true, order: 8, linkedRiskCode: 'groundwater', linkedStageCode: 'reinforcement' },
  { code: 'groundwater_depth', label: 'Глубина грунтовых вод', hint: 'Если известно, м', type: 'NUMBER', required: false, order: 9, unit: 'м', conditionalOn: { questionCode: 'groundwater', op: 'eq', value: true } },
  { code: 'access_ok', label: 'Есть подъезд для техники?', type: 'BOOLEAN', required: true, order: 10, linkedRiskCode: 'access', linkedStageCode: 'earthwork' },
  { code: 'removal_distance', label: 'Расстояние вывоза грунта', hint: 'До полигона, км', type: 'DISTANCE', required: false, order: 11, unit: 'км' },
  { code: 'need_electrical', label: 'Нужна электрика в погребе?', type: 'BOOLEAN', required: true, order: 12, linkedStageCode: 'electrical' },
  { code: 'photos', label: 'Фотографии участка', type: 'PHOTO', required: false, order: 13 },
  { code: 'comment', label: 'Комментарий', type: 'TEXT', required: false, order: 14 },
];

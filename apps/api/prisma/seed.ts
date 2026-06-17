import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  EQUIPMENT,
  FORMULAS,
  MATERIALS,
  MATERIAL_CATEGORIES,
  QUESTIONS,
  RISKS,
  SPECIALISTS,
  STAGES,
} from './seed-data';

const prisma = new PrismaClient();

const REGIONS = [
  { code: 'RU-MOW', name: 'Москва', priceFactor: 1.0 },
  { code: 'RU-MOS', name: 'Московская область', priceFactor: 0.95 },
  { code: 'RU-SPE', name: 'Санкт-Петербург', priceFactor: 0.98 },
  { code: 'RU-KDA', name: 'Краснодарский край', priceFactor: 0.9 },
  { code: 'RU-NVS', name: 'Новосибирская область', priceFactor: 0.92 },
];

const TEMPLATE_SLUG = 'plastic-cellar';

async function seedRegions() {
  for (const r of REGIONS) {
    await prisma.region.upsert({
      where: { code: r.code },
      create: { code: r.code, name: r.name, priceFactor: new Prisma.Decimal(r.priceFactor) },
      update: { name: r.name, priceFactor: new Prisma.Decimal(r.priceFactor) },
    });
  }
  console.log(`✓ Регионы: ${REGIONS.length}`);
}

async function seedCatalog() {
  for (const c of MATERIAL_CATEGORIES) {
    await prisma.materialCategory.upsert({
      where: { code: c.code },
      create: { code: c.code, name: c.name },
      update: { name: c.name },
    });
  }

  const regions = await prisma.region.findMany();
  for (const m of MATERIALS) {
    const category = await prisma.materialCategory.findUniqueOrThrow({ where: { code: m.categoryCode } });
    const material = await prisma.material.upsert({
      where: { sku: m.sku },
      create: { sku: m.sku, name: m.name, unit: m.unit, categoryId: category.id },
      update: { name: m.name, unit: m.unit, categoryId: category.id },
    });
    // Региональные цены: базовая * региональный коэффициент
    for (const region of regions) {
      const exists = await prisma.regionalPrice.findFirst({
        where: { materialId: material.id, regionId: region.id, validTo: null },
      });
      const price = new Prisma.Decimal((m.basePrice * Number(region.priceFactor)).toFixed(2));
      if (!exists) {
        await prisma.regionalPrice.create({
          data: { materialId: material.id, regionId: region.id, price, source: 'seed' },
        });
      }
    }
  }
  console.log(`✓ Материалы: ${MATERIALS.length}, цены по регионам`);

  for (const s of SPECIALISTS) {
    await prisma.specialist.upsert({
      where: { code: s.code },
      create: {
        code: s.code,
        name: s.name,
        workType: s.workType as any,
        dayRateHint: new Prisma.Decimal(s.dayRateHint),
      },
      update: { name: s.name, dayRateHint: new Prisma.Decimal(s.dayRateHint) },
    });
  }
  for (const e of EQUIPMENT) {
    await prisma.equipment.upsert({
      where: { code: e.code },
      create: { code: e.code, name: e.name, unit: e.unit, rateHint: new Prisma.Decimal(e.rateHint) },
      update: { name: e.name, rateHint: new Prisma.Decimal(e.rateHint) },
    });
  }
  for (const r of RISKS) {
    await prisma.risk.upsert({
      where: { code: r.code },
      create: { code: r.code, title: r.title, description: r.description, severity: r.severity, mitigation: r.mitigation },
      update: { title: r.title, description: r.description, severity: r.severity, mitigation: r.mitigation },
    });
  }
  console.log(`✓ Специалисты: ${SPECIALISTS.length}, техника: ${EQUIPMENT.length}, риски: ${RISKS.length}`);
}

async function seedFormulas(authorId: string) {
  for (const f of FORMULAS) {
    const existing = await prisma.formula.findUnique({ where: { key: f.key } });
    if (existing) continue;
    await prisma.formula.create({
      data: {
        key: f.key,
        name: f.name,
        description: f.description,
        unit: f.unit,
        versions: {
          create: {
            version: 1,
            expression: f.expression,
            variables: f.variables as any,
            safetyFactor: new Prisma.Decimal(f.safetyFactor ?? 1),
            rounding: (f.rounding ?? 'NEAREST') as any,
            roundingStep: new Prisma.Decimal(f.roundingStep ?? 1),
            minValue: f.minValue != null ? new Prisma.Decimal(f.minValue) : null,
            regionFactorOn: f.regionFactorOn ?? false,
            authorId,
            changeNote: 'Начальная версия (seed)',
          },
        },
      },
    });
  }
  console.log(`✓ Формулы: ${FORMULAS.length}`);
}

async function seedTemplate() {
  // Пересоздаём шаблон для идемпотентности
  const existing = await prisma.projectTemplate.findUnique({ where: { slug: TEMPLATE_SLUG } });
  if (existing) {
    await prisma.projectTemplate.delete({ where: { id: existing.id } });
  }

  const template = await prisma.projectTemplate.create({
    data: {
      slug: TEMPLATE_SLUG,
      name: 'Монтаж пластикового погреба',
      description:
        'Полный цикл установки пластикового погреба: от анализа участка до финальной приёмки. ' +
        'Платформа разбивает проект на этапы и помогает сэкономить, заказывая работы и материалы по отдельности.',
      workType: 'INSTALLATION',
      questionnaire: {
        create: {
          title: 'Анкета: монтаж пластикового погреба',
          description: 'Ответьте на вопросы — мы рассчитаем смету и этапы.',
          questions: {
            create: QUESTIONS.map((q) => ({
              code: q.code,
              label: q.label,
              hint: q.hint,
              type: q.type as any,
              required: q.required,
              order: q.order,
              variableKey: q.variableKey,
              unit: q.unit,
              linkedStageCode: q.linkedStageCode,
              linkedRiskCode: q.linkedRiskCode,
              validation: (q.validation as any) ?? undefined,
              conditionalOn: (q.conditionalOn as any) ?? undefined,
              options: q.options
                ? { create: q.options.map((o, i) => ({ value: o.value, label: o.label, order: i })) }
                : undefined,
            })),
          },
        },
      },
    },
  });

  // Этапы
  const materials = await prisma.material.findMany();
  const specialists = await prisma.specialist.findMany();
  const equipment = await prisma.equipment.findMany();
  const risks = await prisma.risk.findMany();
  const formulas = await prisma.formula.findMany();

  const matBySku = new Map(materials.map((m) => [m.sku, m]));
  const specByCode = new Map(specialists.map((s) => [s.code, s]));
  const eqByCode = new Map(equipment.map((e) => [e.code, e]));
  const riskByCode = new Map(risks.map((r) => [r.code, r]));
  const formulaByKey = new Map(formulas.map((f) => [f.key, f]));

  const codeToId = new Map<string, string>();
  let order = 1;
  for (const s of STAGES) {
    const stage = await prisma.stageTemplate.create({
      data: {
        templateId: template.id,
        code: s.code,
        order: order++,
        name: s.name,
        description: s.description,
        workType: s.workType as any,
        estimatedDays: new Prisma.Decimal(s.estimatedDays),
        photoRequirements: s.photoRequirements as any,
        checklist: s.checklist as any,
        acceptanceCriteria: s.acceptanceCriteria as any,
        materials: {
          create: s.materials.map((m) => {
            const mat = matBySku.get(m.sku);
            if (!mat) throw new Error(`Материал ${m.sku} не найден`);
            return {
              materialId: mat.id,
              quantityFormulaId: m.formulaKey ? formulaByKey.get(m.formulaKey)?.id : null,
              fixedQuantity: m.fixedQuantity != null ? new Prisma.Decimal(m.fixedQuantity) : null,
            };
          }),
        },
        specialists: {
          create: s.specialists.map((sp) => ({
            specialistId: specByCode.get(sp.code)!.id,
            count: sp.count,
          })),
        },
        equipment: {
          create: s.equipment.map((eq) => ({
            equipmentId: eqByCode.get(eq.code)!.id,
            count: eq.count,
          })),
        },
        risks: {
          create: s.risks.map((rc) => ({ riskId: riskByCode.get(rc)!.id })),
        },
      },
    });
    codeToId.set(s.code, stage.id);
  }

  // Зависимости между этапами
  for (const s of STAGES) {
    for (const dep of s.dependsOn) {
      await prisma.stageTemplateDependency.create({
        data: { stageId: codeToId.get(s.code)!, requiresId: codeToId.get(dep)! },
      });
    }
  }
  console.log(`✓ Шаблон «${template.name}»: этапов ${STAGES.length}, вопросов ${QUESTIONS.length}`);
  return template;
}

async function seedSettingsAndCommission() {
  await prisma.systemSetting.upsert({
    where: { key: 'estimate.turnkeyMultiplier' },
    create: { key: 'estimate.turnkeyMultiplier', value: 1.55 },
    update: { value: 1.55 },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'platform.name' },
    create: { key: 'platform.name', value: 'Razby.ru' },
    update: { value: 'Razby.ru' },
  });

  const hasCommission = await prisma.commissionRule.findFirst({ where: { isActive: true } });
  if (!hasCommission) {
    await prisma.commissionRule.create({
      data: { name: 'Базовая комиссия 5%', percent: new Prisma.Decimal(5), minAmount: new Prisma.Decimal(0) },
    });
  }

  await prisma.promoCode.upsert({
    where: { code: 'RAZBY10' },
    create: { code: 'RAZBY10', description: 'Скидка 10% новым заказчикам', percentOff: new Prisma.Decimal(10) },
    update: {},
  });
  console.log('✓ Настройки, комиссия, промокод RAZBY10');
}

interface UserSeed {
  email: string;
  password: string;
  role: string;
  firstName: string;
  lastName: string;
  regionCode?: string;
  provider?: {
    companyName: string;
    workTypes: string[];
    rating: number;
    reviews: number;
    completed: number;
    cancelled: number;
    onTime: number;
    warranty: number;
    verified: boolean;
    lat: number;
    lng: number;
  };
}

async function seedUsers(): Promise<string> {
  const commonPass = 'Razby2025!';
  const users: UserSeed[] = [
    { email: 'alexeyloginov90@gmail.com', password: 'Razby-Super-2025!', role: 'SUPERADMIN', firstName: 'Алексей', lastName: 'Логинов' },
    { email: 'admin@razby.ru', password: commonPass, role: 'ADMIN', firstName: 'Админ', lastName: 'Платформы' },
    { email: 'coordinator@razby.ru', password: commonPass, role: 'COORDINATOR', firstName: 'Координатор', lastName: 'Проектов' },
    { email: 'customer@razby.ru', password: commonPass, role: 'CUSTOMER', firstName: 'Иван', lastName: 'Заказчиков', regionCode: 'RU-MOS' },
    {
      email: 'contractor@razby.ru', password: commonPass, role: 'CONTRACTOR', firstName: 'Пётр', lastName: 'Строев', regionCode: 'RU-MOS',
      provider: { companyName: 'СтройКоманда', workTypes: ['EARTHWORK', 'FOUNDATION', 'CONCRETE', 'REINFORCEMENT'], rating: 4.8, reviews: 47, completed: 53, cancelled: 1, onTime: 0.96, warranty: 24, verified: true, lat: 55.75, lng: 37.62 },
    },
    {
      email: 'contractor2@razby.ru', password: commonPass, role: 'CONTRACTOR', firstName: 'Сергей', lastName: 'Котлован', regionCode: 'RU-MOS',
      provider: { companyName: 'ЗемРаботы24', workTypes: ['EARTHWORK', 'LOGISTICS'], rating: 4.3, reviews: 18, completed: 22, cancelled: 3, onTime: 0.88, warranty: 12, verified: true, lat: 55.9, lng: 37.4 },
    },
    {
      email: 'contractor3@razby.ru', password: commonPass, role: 'CONTRACTOR', firstName: 'Новичок', lastName: 'Начинающий', regionCode: 'RU-MOS',
      provider: { companyName: 'ИП Свежий', workTypes: ['EARTHWORK', 'INSTALLATION'], rating: 0, reviews: 0, completed: 0, cancelled: 0, onTime: 1, warranty: 6, verified: false, lat: 56.1, lng: 37.9 },
    },
    {
      email: 'supplier@razby.ru', password: commonPass, role: 'SUPPLIER', firstName: 'Мария', lastName: 'Поставкина', regionCode: 'RU-MOW',
      provider: { companyName: 'БазаСтройМаркет', workTypes: ['FOUNDATION'], rating: 4.6, reviews: 31, completed: 120, cancelled: 4, onTime: 0.94, warranty: 0, verified: true, lat: 55.7, lng: 37.5 },
    },
    {
      email: 'carrier@razby.ru', password: commonPass, role: 'CARRIER', firstName: 'Николай', lastName: 'Перевозов', regionCode: 'RU-MOS',
      provider: { companyName: 'ГрузАвто', workTypes: ['LOGISTICS'], rating: 4.5, reviews: 22, completed: 60, cancelled: 2, onTime: 0.92, warranty: 0, verified: true, lat: 55.6, lng: 37.7 },
    },
  ];

  let superAdminId = '';
  for (const u of users) {
    const passwordHash = await argon2.hash(u.password, { type: argon2.argon2id });
    const region = u.regionCode ? await prisma.region.findUnique({ where: { code: u.regionCode } }) : null;

    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        passwordHash,
        role: u.role as any,
        firstName: u.firstName,
        lastName: u.lastName,
        emailVerified: true,
        phoneVerified: true,
        regionId: region?.id,
      },
      update: { passwordHash, role: u.role as any, regionId: region?.id },
    });
    if (u.role === 'SUPERADMIN') superAdminId = user.id;

    if (u.provider) {
      await prisma.providerProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          companyName: u.provider.companyName,
          workTypes: u.provider.workTypes as any,
          ratingAvg: new Prisma.Decimal(u.provider.rating),
          reviewsCount: u.provider.reviews,
          completedOrders: u.provider.completed,
          cancelledOrders: u.provider.cancelled,
          onTimeRate: new Prisma.Decimal(u.provider.onTime),
          warrantyMonths: u.provider.warranty,
          verificationStatus: u.provider.verified ? 'VERIFIED' : 'PENDING',
          verifiedAt: u.provider.verified ? new Date() : null,
          baseLat: u.provider.lat,
          baseLng: u.provider.lng,
        },
        update: {
          companyName: u.provider.companyName,
          ratingAvg: new Prisma.Decimal(u.provider.rating),
          reviewsCount: u.provider.reviews,
          completedOrders: u.provider.completed,
          cancelledOrders: u.provider.cancelled,
          onTimeRate: new Prisma.Decimal(u.provider.onTime),
          warrantyMonths: u.provider.warranty,
          verificationStatus: u.provider.verified ? 'VERIFIED' : 'PENDING',
          baseLat: u.provider.lat,
          baseLng: u.provider.lng,
        },
      });
    }
  }
  console.log(`✓ Пользователи: ${users.length}`);
  return superAdminId;
}

async function main() {
  console.log('▶ Seed Razby.ru…');
  await seedRegions();
  const superAdminId = await seedUsers();
  await seedCatalog();
  await seedFormulas(superAdminId);
  await seedTemplate();
  await seedSettingsAndCommission();

  console.log('\n✅ Готово. Тестовые аккаунты:');
  console.log('  Суперадмин:   alexeyloginov90@gmail.com / Razby-Super-2025!');
  console.log('  Админ:        admin@razby.ru / Razby2025!');
  console.log('  Координатор:  coordinator@razby.ru / Razby2025!');
  console.log('  Заказчик:     customer@razby.ru / Razby2025!');
  console.log('  Подрядчики:   contractor@razby.ru, contractor2@razby.ru, contractor3@razby.ru / Razby2025!');
  console.log('  Поставщик:    supplier@razby.ru / Razby2025!');
  console.log('  Перевозчик:   carrier@razby.ru / Razby2025!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

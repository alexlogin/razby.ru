import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@razby/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EstimateBuilderService } from './estimate-builder.service';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { CreateProjectDto, SaveAnswersDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estimateBuilder: EstimateBuilderService,
    private readonly audit: AuditService,
  ) {}

  private staff(user: RequestUser): boolean {
    return [Role.COORDINATOR, Role.ADMIN, Role.SUPERADMIN].includes(user.role);
  }

  /** Доступ к проекту: владелец, координатор проекта, персонал, либо участник-исполнитель. */
  async assertAccess(projectId: string, user: RequestUser): Promise<void> {
    if (this.staff(user)) return;
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { customerId: true, coordinatorId: true },
    });
    if (!project) throw new NotFoundException('Проект не найден');
    if (project.customerId === user.sub || project.coordinatorId === user.sub) return;

    // Исполнитель имеет доступ, если у него есть оффер по проекту
    const offer = await this.prisma.offer.findFirst({
      where: { projectId, providerId: user.sub },
      select: { id: true },
    });
    if (offer) return;
    throw new ForbiddenException('Нет доступа к этому проекту');
  }

  async create(dto: CreateProjectDto, user: RequestUser) {
    let templateId: string | undefined;
    if (dto.templateSlug) {
      const template = await this.prisma.projectTemplate.findUnique({
        where: { slug: dto.templateSlug },
      });
      if (!template || !template.isActive) throw new BadRequestException('Шаблон не найден');
      templateId = template.id;
    }

    let regionId: string | undefined;
    if (dto.regionCode) {
      const region = await this.prisma.region.findUnique({ where: { code: dto.regionCode } });
      regionId = region?.id;
    }

    const project = await this.prisma.project.create({
      data: {
        customerId: user.sub,
        templateId,
        regionId,
        title: dto.title,
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        status: 'DRAFT',
      },
    });

    await this.audit.log({
      actorId: user.sub,
      action: 'project.create',
      entityType: 'Project',
      entityId: project.id,
    });
    return project;
  }

  async listForUser(user: RequestUser) {
    if (this.staff(user)) {
      return this.prisma.project.findMany({
        include: { template: true, region: true, customer: { select: { email: true, firstName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
    }
    if (user.role === Role.CUSTOMER) {
      return this.prisma.project.findMany({
        where: { customerId: user.sub },
        include: { template: true, region: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    // Исполнители видят проекты, где у них есть офферы
    return this.prisma.project.findMany({
      where: { offers: { some: { providerId: user.sub } } },
      include: { template: true, region: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFull(projectId: string, user: RequestUser) {
    await this.assertAccess(projectId, user);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        template: { include: { questionnaire: { include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } } } } },
        region: true,
        customer: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        coordinator: { select: { id: true, email: true, firstName: true } },
        answers: true,
        stages: {
          include: { materials: true, dependsOn: true, acceptanceAct: true },
          orderBy: { order: 'asc' },
        },
        estimates: { where: { isCurrent: true }, include: { items: true } },
        deliveries: true,
      },
    });
    if (!project) throw new NotFoundException('Проект не найден');
    return project;
  }

  /** Сводка для дашборда проекта. */
  async getSummary(projectId: string, user: RequestUser) {
    await this.assertAccess(projectId, user);
    const [project, current, firstEstimate, stages] = await Promise.all([
      this.prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
      this.prisma.estimate.findFirst({ where: { projectId, isCurrent: true } }),
      this.prisma.estimate.findFirst({ where: { projectId }, orderBy: { version: 'asc' } }),
      this.prisma.projectStage.findMany({ where: { projectId }, orderBy: { order: 'asc' } }),
    ]);

    const actualCost = stages.reduce((sum, s) => sum + Number(s.actualCost), 0);
    const accepted = stages.filter((s) => s.status === 'ACCEPTED').length;
    const progress = stages.length ? Math.round((accepted / stages.length) * 100) : 0;
    const nextStage = stages.find((s) => s.status === 'PENDING' || s.status === 'SCHEDULED');
    const delays = stages.filter(
      (s) => s.plannedEnd && !s.actualEnd && s.plannedEnd < new Date() && s.status !== 'ACCEPTED',
    );
    const materialsToOrder = await this.prisma.projectStageMaterial.findMany({
      where: { stage: { projectId }, ordered: false },
      include: { material: true },
    });
    const stagesNeedContractor = stages.filter((s) => !s.assigneeId && s.status === 'PENDING');
    const upcomingDeliveries = await this.prisma.delivery.findMany({
      where: { projectId, deliveredAt: null },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    });
    const lastMessages = await this.prisma.message.findMany({
      where: { conversation: { projectId } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { sender: { select: { firstName: true, role: true } } },
    });

    const initialBudget = firstEstimate ? Number(firstEstimate.total) : 0;
    const currentBudget = current ? Number(current.total) : 0;
    const turnkey = current ? Number(current.turnkeyTotal) : 0;

    return {
      progress,
      status: project.status,
      initialBudget,
      currentBudget,
      actualCost: Number(actualCost.toFixed(2)),
      potentialSavings: Number(Math.max(turnkey - currentBudget, 0).toFixed(2)),
      turnkeyEstimate: turnkey,
      nextStage: nextStage
        ? { code: nextStage.code, name: nextStage.name, status: nextStage.status }
        : null,
      delays: delays.map((d) => ({ code: d.code, name: d.name, plannedEnd: d.plannedEnd })),
      materialsToOrder: materialsToOrder.map((m) => ({
        material: m.material.name,
        quantity: Number(m.quantity),
        unit: m.unit,
      })),
      stagesNeedContractor: stagesNeedContractor.map((s) => ({ code: s.code, name: s.name })),
      upcomingDeliveries,
      lastMessages,
    };
  }

  async saveAnswers(projectId: string, dto: SaveAnswersDto, user: RequestUser) {
    await this.assertAccess(projectId, user);
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });

    // Валидация по анкете шаблона
    if (project.templateId) {
      const questionnaire = await this.prisma.questionnaire.findUnique({
        where: { templateId: project.templateId },
        include: { questions: true },
      });
      const validCodes = new Set(questionnaire?.questions.map((q) => q.code) ?? []);
      for (const a of dto.answers) {
        if (!validCodes.has(a.questionCode)) {
          throw new BadRequestException(`Неизвестный вопрос: ${a.questionCode}`);
        }
      }
    }

    await this.prisma.$transaction(
      dto.answers.map((a) =>
        this.prisma.projectAnswer.upsert({
          where: { projectId_questionCode: { projectId, questionCode: a.questionCode } },
          create: {
            projectId,
            questionCode: a.questionCode,
            value: a.value as Prisma.InputJsonValue,
            authorId: user.sub,
          },
          update: { value: a.value as Prisma.InputJsonValue, authorId: user.sub },
        }),
      ),
    );

    return this.prisma.projectAnswer.findMany({ where: { projectId } });
  }

  /** Проверяет обязательные вопросы и запускает расчёт сметы. */
  async calculate(projectId: string, user: RequestUser) {
    await this.assertAccess(projectId, user);
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    if (!project.templateId) throw new BadRequestException('У проекта не выбран шаблон');

    const questionnaire = await this.prisma.questionnaire.findUnique({
      where: { templateId: project.templateId },
      include: { questions: true },
    });
    const answers = await this.prisma.projectAnswer.findMany({ where: { projectId } });
    const answered = new Map(answers.map((a) => [a.questionCode, a.value]));

    const missing = (questionnaire?.questions ?? [])
      .filter((q) => q.required && !this.isConditional(q))
      .filter((q) => {
        const v = answered.get(q.code);
        return v == null || v === '' || (Array.isArray(v) && v.length === 0);
      })
      .map((q) => q.label);

    if (missing.length > 0) {
      throw new BadRequestException(`Заполните обязательные поля: ${missing.join(', ')}`);
    }

    await this.prisma.project.update({ where: { id: projectId }, data: { status: 'CALCULATING' } });
    const result = await this.estimateBuilder.rebuild(projectId);
    await this.audit.log({
      actorId: user.sub,
      action: 'project.calculate',
      entityType: 'Project',
      entityId: projectId,
      after: { total: result.total },
    });
    return result;
  }

  private isConditional(q: { conditionalOn: Prisma.JsonValue }): boolean {
    return q.conditionalOn != null;
  }

  async getEstimateHistory(projectId: string, user: RequestUser) {
    await this.assertAccess(projectId, user);
    return this.prisma.estimate.findMany({
      where: { projectId },
      orderBy: { version: 'desc' },
      include: { items: true },
    });
  }
}

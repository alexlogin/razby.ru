import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ProjectStage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../common/decorators/current-user.decorator';

export interface StartReadiness {
  ok: boolean;
  reasons: string[];
}

@Injectable()
export class StagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
    private readonly audit: AuditService,
  ) {}

  private async load(stageId: string) {
    const stage = await this.prisma.projectStage.findUnique({
      where: { id: stageId },
      include: {
        dependsOn: { include: { requires: true } },
        materials: true,
        deliveries: true,
      },
    });
    if (!stage) throw new NotFoundException('Этап не найден');
    return stage;
  }

  /**
   * Проверка готовности этапа к старту. Этап нельзя начать, если:
   * не принят предыдущий этап; не выбраны материалы; материал не доставлен;
   * не выбран исполнитель/не подтверждена дата; не выполнен обязательный чек-лист.
   */
  async checkReadiness(stageId: string): Promise<StartReadiness> {
    const stage = await this.load(stageId);
    const reasons: string[] = [];

    for (const dep of stage.dependsOn) {
      if (dep.requires.status !== 'ACCEPTED') {
        reasons.push(`Не принят предыдущий этап: «${dep.requires.name}»`);
      }
    }

    if (stage.materials.length > 0) {
      const notOrdered = stage.materials.filter((m) => !m.ordered);
      if (notOrdered.length > 0) {
        reasons.push(`Материалы не заказаны/не доставлены (${notOrdered.length} поз.)`);
      }
    }

    if (!stage.assigneeId) {
      reasons.push('Не выбран исполнитель');
    }
    if (!stage.plannedStart) {
      reasons.push('Не подтверждена дата начала');
    }

    const checklist = (stage.checklistState as Array<{ required?: boolean; done?: boolean; label: string }>) ?? [];
    const requiredUndone = checklist.filter((c) => c.required && !c.done);
    if (requiredUndone.length > 0) {
      reasons.push(`Не выполнен обязательный чек-лист: ${requiredUndone.map((c) => c.label).join(', ')}`);
    }

    return { ok: reasons.length === 0, reasons };
  }

  /** Назначить исполнителя и плановые даты. */
  async schedule(
    stageId: string,
    data: { assigneeId?: string; plannedStart?: string; plannedEnd?: string },
    user: RequestUser,
  ) {
    const stage = await this.load(stageId);
    const updated = await this.prisma.projectStage.update({
      where: { id: stageId },
      data: {
        assigneeId: data.assigneeId ?? stage.assigneeId,
        plannedStart: data.plannedStart ? new Date(data.plannedStart) : stage.plannedStart,
        plannedEnd: data.plannedEnd ? new Date(data.plannedEnd) : stage.plannedEnd,
        status: stage.status === 'PENDING' ? 'SCHEDULED' : stage.status,
      },
    });
    await this.audit.log({
      actorId: user.sub,
      action: 'stage.schedule',
      entityType: 'ProjectStage',
      entityId: stageId,
    });
    this.realtime.emitToProject(stage.projectId, 'stage.updated', updated);
    return updated;
  }

  async start(stageId: string, user: RequestUser): Promise<ProjectStage> {
    const readiness = await this.checkReadiness(stageId);
    if (!readiness.ok) {
      throw new BadRequestException(`Этап нельзя начать: ${readiness.reasons.join('; ')}`);
    }
    const stage = await this.prisma.projectStage.update({
      where: { id: stageId },
      data: { status: 'IN_PROGRESS', actualStart: new Date() },
    });
    await this.audit.log({
      actorId: user.sub,
      action: 'stage.start',
      entityType: 'ProjectStage',
      entityId: stageId,
    });
    this.realtime.emitToProject(stage.projectId, 'stage.updated', stage);
    await this.prisma.project.update({
      where: { id: stage.projectId },
      data: { status: 'IN_PROGRESS' },
    });
    return stage;
  }

  /** Исполнитель отправляет этап на приёмку. */
  async submitForReview(stageId: string, user: RequestUser) {
    const stage = await this.prisma.projectStage.update({
      where: { id: stageId },
      data: { status: 'REVIEW' },
    });
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: stage.projectId } });
    await this.notifications.notify({
      userId: project.customerId,
      type: 'STAGE' as any,
      projectId: stage.projectId,
      title: 'Этап готов к приёмке',
      body: `Этап «${stage.name}» отправлен на приёмку`,
    });
    this.realtime.emitToProject(stage.projectId, 'stage.updated', stage);
    void user;
    return stage;
  }

  /** Приёмка этапа заказчиком: формируется акт, разблокируются следующие этапы. */
  async accept(stageId: string, data: { amount?: number; note?: string }, user: RequestUser) {
    const stage = await this.load(stageId);
    if (stage.status !== 'REVIEW' && stage.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Этап не находится на стадии выполнения/приёмки');
    }

    const actNumber = `ACT-${stage.code}-${Date.now().toString().slice(-6)}`;
    const amount = data.amount ?? Number(stage.estimatedCost);

    const accepted = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectStage.update({
        where: { id: stageId },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          actualEnd: new Date(),
          actualCost: new Prisma.Decimal(amount),
        },
      });
      await tx.acceptanceAct.upsert({
        where: { stageId },
        create: {
          stageId,
          number: actNumber,
          acceptedById: user.sub,
          amount: new Prisma.Decimal(amount),
          note: data.note,
        },
        update: { amount: new Prisma.Decimal(amount), note: data.note },
      });
      return updated;
    });

    await this.unblockDependents(stage.projectId);
    await this.recalcProgress(stage.projectId);

    await this.audit.log({
      actorId: user.sub,
      action: 'stage.accept',
      entityType: 'ProjectStage',
      entityId: stageId,
      after: { amount },
    });
    this.realtime.emitToProject(stage.projectId, 'stage.updated', accepted);

    if (stage.assigneeId) {
      await this.notifications.notify({
        userId: stage.assigneeId,
        type: 'STAGE' as any,
        projectId: stage.projectId,
        title: 'Этап принят',
        body: `Заказчик принял этап «${stage.name}»`,
      });
    }
    return accepted;
  }

  async reject(stageId: string, reason: string, user: RequestUser) {
    const stage = await this.prisma.projectStage.update({
      where: { id: stageId },
      data: { status: 'REJECTED', rejectionReason: reason },
    });
    if (stage.assigneeId) {
      await this.notifications.notify({
        userId: stage.assigneeId,
        type: 'STAGE' as any,
        projectId: stage.projectId,
        title: 'Этап отклонён',
        body: reason,
      });
    }
    await this.audit.log({
      actorId: user.sub,
      action: 'stage.reject',
      entityType: 'ProjectStage',
      entityId: stageId,
    });
    this.realtime.emitToProject(stage.projectId, 'stage.updated', stage);
    return stage;
  }

  /** Обновление чек-листа этапа. */
  async updateChecklist(
    stageId: string,
    items: Array<{ code: string; done: boolean }>,
    user: RequestUser,
  ) {
    const stage = await this.load(stageId);
    const checklist = (stage.checklistState as Array<{ code: string; done?: boolean; doneAt?: string }>) ?? [];
    const map = new Map(items.map((i) => [i.code, i.done]));
    const next = checklist.map((c) =>
      map.has(c.code)
        ? { ...c, done: map.get(c.code), doneAt: map.get(c.code) ? new Date().toISOString() : undefined }
        : c,
    );
    const updated = await this.prisma.projectStage.update({
      where: { id: stageId },
      data: { checklistState: next as Prisma.InputJsonValue },
    });
    void user;
    this.realtime.emitToProject(stage.projectId, 'stage.updated', updated);
    return updated;
  }

  /** Помечает материалы этапа заказанными (после оформления поставки). */
  async markMaterialsOrdered(stageId: string) {
    await this.prisma.projectStageMaterial.updateMany({
      where: { stageId },
      data: { ordered: true },
    });
    return { success: true };
  }

  /** Переводит BLOCKED-этапы в PENDING, если все их зависимости приняты. */
  private async unblockDependents(projectId: string): Promise<void> {
    const blocked = await this.prisma.projectStage.findMany({
      where: { projectId, status: 'BLOCKED' },
      include: { dependsOn: { include: { requires: true } } },
    });
    for (const stage of blocked) {
      const ready = stage.dependsOn.every((d) => d.requires.status === 'ACCEPTED');
      if (ready) {
        const updated = await this.prisma.projectStage.update({
          where: { id: stage.id },
          data: { status: 'PENDING' },
        });
        this.realtime.emitToProject(projectId, 'stage.updated', updated);
      }
    }
  }

  private async recalcProgress(projectId: string): Promise<void> {
    const stages = await this.prisma.projectStage.findMany({ where: { projectId } });
    const accepted = stages.filter((s) => s.status === 'ACCEPTED').length;
    const progress = stages.length ? Math.round((accepted / stages.length) * 100) : 0;
    const allDone = stages.length > 0 && accepted === stages.length;
    await this.prisma.project.update({
      where: { id: projectId },
      data: { progress, ...(allDone ? { status: 'COMPLETED' } : {}) },
    });
  }
}

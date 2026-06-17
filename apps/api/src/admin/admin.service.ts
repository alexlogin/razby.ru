import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role } from '@razby/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreatePromoDto,
  SetRegionalPriceDto,
  UpsertCommissionDto,
  UpsertRegionDto,
  VerifyProviderDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async analytics() {
    const [users, projects, byStatus, offers, estimatesAgg, disputes, providersPending] =
      await Promise.all([
        this.prisma.user.groupBy({ by: ['role'], _count: true }),
        this.prisma.project.count(),
        this.prisma.project.groupBy({ by: ['status'], _count: true }),
        this.prisma.offer.count(),
        this.prisma.estimate.aggregate({ where: { isCurrent: true }, _sum: { total: true } }),
        this.prisma.dispute.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }),
        this.prisma.providerProfile.count({ where: { verificationStatus: 'PENDING' } }),
      ]);

    return {
      usersByRole: users.map((u) => ({ role: u.role, count: u._count })),
      projectsTotal: projects,
      projectsByStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      offersTotal: offers,
      estimatedVolume: Number(estimatesAgg._sum.total ?? 0),
      openDisputes: disputes,
      providersPendingVerification: providersPending,
    };
  }

  listUsers(search?: string, role?: Role) {
    return this.prisma.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        firstName: true,
        lastName: true,
        isBlocked: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async setUserRole(userId: string, role: Role, actorId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      // смена роли инвалидирует токены пользователя
      data: { role, tokenVersion: { increment: 1 } },
    });
    await this.audit.log({
      actorId,
      action: 'admin.user.role',
      entityType: 'User',
      entityId: userId,
      after: { role },
    });
    return { id: user.id, role: user.role };
  }

  async setUserBlocked(userId: string, blocked: boolean, actorId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isBlocked: blocked, tokenVersion: { increment: 1 } },
    });
    await this.audit.log({
      actorId,
      action: blocked ? 'admin.user.block' : 'admin.user.unblock',
      entityType: 'User',
      entityId: userId,
    });
    return { success: true };
  }

  listProviders(status?: string) {
    return this.prisma.providerProfile.findMany({
      where: status ? { verificationStatus: status as any } : {},
      include: {
        user: { select: { id: true, email: true, role: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verifyProvider(userId: string, dto: VerifyProviderDto, actorId: string) {
    const profile = await this.prisma.providerProfile.update({
      where: { userId },
      data: {
        verificationStatus: dto.approve ? 'VERIFIED' : 'REJECTED',
        verifiedAt: dto.approve ? new Date() : null,
      },
    });
    await this.notifications.notify({
      userId,
      title: dto.approve ? 'Профиль подтверждён' : 'Профиль отклонён',
      body: dto.note ?? (dto.approve ? 'Вы можете участвовать в тендерах' : 'Проверьте документы'),
    });
    await this.audit.log({
      actorId,
      action: 'admin.provider.verify',
      entityType: 'ProviderProfile',
      entityId: profile.id,
      after: { status: profile.verificationStatus },
    });
    return profile;
  }

  listAudit(entityType?: string, take = 200) {
    return this.prisma.auditLog.findMany({
      where: entityType ? { entityType } : {},
      include: { actor: { select: { email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  listDisputes(status?: string) {
    return this.prisma.dispute.findMany({
      where: status ? { status: status as any } : {},
      include: {
        project: { select: { title: true, number: true } },
        openedBy: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveDispute(id: string, resolution: string, approve: boolean, actorId: string) {
    const dispute = await this.prisma.dispute.update({
      where: { id },
      data: { status: approve ? 'RESOLVED' : 'REJECTED', resolution },
    });
    await this.audit.log({
      actorId,
      action: 'admin.dispute.resolve',
      entityType: 'Dispute',
      entityId: id,
    });
    return dispute;
  }

  async upsertRegion(dto: UpsertRegionDto, actorId: string) {
    const region = await this.prisma.region.upsert({
      where: { code: dto.code },
      create: {
        code: dto.code,
        name: dto.name,
        priceFactor: new Prisma.Decimal(dto.priceFactor ?? 1),
        timezone: dto.timezone ?? 'Europe/Moscow',
      },
      update: {
        name: dto.name,
        priceFactor: dto.priceFactor != null ? new Prisma.Decimal(dto.priceFactor) : undefined,
        timezone: dto.timezone,
      },
    });
    await this.audit.log({
      actorId,
      action: 'admin.region.upsert',
      entityType: 'Region',
      entityId: region.id,
    });
    return region;
  }

  /** Установка региональной цены: закрывает текущую и создаёт новую (история цен). */
  async setRegionalPrice(dto: SetRegionalPriceDto, actorId: string) {
    const region = await this.prisma.region.findUnique({ where: { code: dto.regionCode } });
    if (!region) throw new NotFoundException('Регион не найден');

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.regionalPrice.updateMany({
        where: { materialId: dto.materialId, regionId: region.id, validTo: null },
        data: { validTo: now },
      });
      return tx.regionalPrice.create({
        data: {
          materialId: dto.materialId,
          regionId: region.id,
          price: new Prisma.Decimal(dto.price),
          validFrom: now,
          source: 'admin',
        },
      });
    });
    await this.audit.log({
      actorId,
      action: 'admin.price.set',
      entityType: 'RegionalPrice',
      entityId: result.id,
      after: { price: dto.price },
    });
    return result;
  }

  async upsertCommission(dto: UpsertCommissionDto, actorId: string) {
    await this.prisma.commissionRule.updateMany({ where: { isActive: true }, data: { isActive: false } });
    const rule = await this.prisma.commissionRule.create({
      data: {
        name: dto.name,
        percent: new Prisma.Decimal(dto.percent),
        minAmount: new Prisma.Decimal(dto.minAmount ?? 0),
        isActive: true,
      },
    });
    await this.audit.log({
      actorId,
      action: 'admin.commission.upsert',
      entityType: 'CommissionRule',
      entityId: rule.id,
    });
    return rule;
  }

  async createPromo(dto: CreatePromoDto, actorId: string) {
    const promo = await this.prisma.promoCode.create({
      data: {
        code: dto.code.toUpperCase(),
        percentOff: dto.percentOff != null ? new Prisma.Decimal(dto.percentOff) : null,
        amountOff: dto.amountOff != null ? new Prisma.Decimal(dto.amountOff) : null,
        maxRedemptions: dto.maxRedemptions,
        validTo: dto.validTo ? new Date(dto.validTo) : null,
      },
    });
    await this.audit.log({
      actorId,
      action: 'admin.promo.create',
      entityType: 'PromoCode',
      entityId: promo.id,
    });
    return promo;
  }

  listPromos() {
    return this.prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
  }

  listSettings() {
    return this.prisma.systemSetting.findMany();
  }

  async setSetting(key: string, value: unknown, actorId: string) {
    const setting = await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
    await this.audit.log({
      actorId,
      action: 'admin.setting.set',
      entityType: 'SystemSetting',
      entityId: key,
    });
    return setting;
  }
}

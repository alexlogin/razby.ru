import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role, RECOMMENDATION_LABELS_RU } from '@razby/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ComparisonService, type OfferForScoring } from './comparison.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { CreateTenderDto, SubmitOfferDto } from './dto/offer.dto';

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly comparison: ComparisonService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  private haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const R = 6371;
    const dLat = ((bLat - aLat) * Math.PI) / 180;
    const dLng = ((bLng - aLng) * Math.PI) / 180;
    const lat1 = (aLat * Math.PI) / 180;
    const lat2 = (bLat * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return Number((R * 2 * Math.asin(Math.sqrt(h))).toFixed(1));
  }

  async createTender(dto: CreateTenderDto, user: RequestUser) {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Проект не найден');
    const isOwner = project.customerId === user.sub || project.coordinatorId === user.sub;
    const isStaff = [Role.COORDINATOR, Role.ADMIN, Role.SUPERADMIN].includes(user.role);
    if (!isOwner && !isStaff) throw new ForbiddenException('Нет прав на создание тендера');

    const tender = await this.prisma.tender.create({
      data: {
        projectId: dto.projectId,
        stageId: dto.stageId,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        spec: (dto.spec as Prisma.InputJsonValue) ?? {},
        deadline: dto.deadline ? new Date(dto.deadline) : null,
      },
    });
    if (project.status === 'ESTIMATED') {
      await this.prisma.project.update({ where: { id: project.id }, data: { status: 'TENDERING' } });
    }
    await this.audit.log({
      actorId: user.sub,
      action: 'tender.create',
      entityType: 'Tender',
      entityId: tender.id,
    });
    return tender;
  }

  /** Открытые тендеры для исполнителя по его роли/типу. */
  async listOpenForProvider(user: RequestUser) {
    const typeByRole: Record<string, string> = {
      [Role.CONTRACTOR]: 'CONTRACTOR',
      [Role.SUPPLIER]: 'SUPPLIER',
      [Role.CARRIER]: 'CARRIER',
    };
    const type = typeByRole[user.role];
    if (!type) throw new ForbiddenException('Доступно только исполнителям');
    return this.prisma.tender.findMany({
      where: { status: 'OPEN', type: type as any },
      include: { project: { select: { title: true, address: true, regionId: true } }, offers: { where: { providerId: user.sub } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async submitOffer(tenderId: string, dto: SubmitOfferDto, user: RequestUser) {
    if (![Role.CONTRACTOR, Role.SUPPLIER, Role.CARRIER].includes(user.role)) {
      throw new ForbiddenException('Предложения подают только исполнители');
    }
    const tender = await this.prisma.tender.findUnique({ where: { id: tenderId } });
    if (!tender) throw new NotFoundException('Тендер не найден');
    if (tender.status !== 'OPEN') throw new BadRequestException('Тендер закрыт');

    const data = {
      price: new Prisma.Decimal(dto.price),
      availableDate: dto.availableDate ? new Date(dto.availableDate) : null,
      durationDays: dto.durationDays != null ? new Prisma.Decimal(dto.durationDays) : null,
      warrantyMonths: dto.warrantyMonths ?? 0,
      comment: dto.comment,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      workersCount: dto.workersCount,
      includes: dto.includes ?? [],
      excludes: dto.excludes ?? [],
      unitPrice: dto.unitPrice != null ? new Prisma.Decimal(dto.unitPrice) : null,
      minOrder: dto.minOrder != null ? new Prisma.Decimal(dto.minOrder) : null,
      inStock: dto.inStock,
      deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : null,
      deliveryCost: dto.deliveryCost != null ? new Prisma.Decimal(dto.deliveryCost) : null,
      unloading: dto.unloading,
      vehicleType: dto.vehicleType,
      capacityTons: dto.capacityTons != null ? new Prisma.Decimal(dto.capacityTons) : null,
      dimensions: dto.dimensions,
      calloutCost: dto.calloutCost != null ? new Prisma.Decimal(dto.calloutCost) : null,
      pricePerKm: dto.pricePerKm != null ? new Prisma.Decimal(dto.pricePerKm) : null,
    };

    // Один активный оффер на исполнителя в тендере: обновляем существующий или создаём новый.
    const existing = await this.prisma.offer.findFirst({
      where: { tenderId, providerId: user.sub },
      select: { id: true },
    });
    const offer = existing
      ? await this.prisma.offer.update({
          where: { id: existing.id },
          data: { ...data, status: 'SUBMITTED' },
        })
      : await this.prisma.offer.create({
          data: {
            tenderId,
            projectId: tender.projectId,
            stageId: tender.stageId,
            providerId: user.sub,
            type: tender.type,
            ...data,
          },
        });

    const project = await this.prisma.project.findUnique({ where: { id: tender.projectId } });
    if (project) {
      await this.notifications.notify({
        userId: project.customerId,
        type: 'OFFER' as any,
        projectId: project.id,
        title: 'Новое предложение',
        body: `Поступило предложение на «${tender.title}»: ${dto.price.toLocaleString('ru-RU')} ₽`,
      });
    }
    return offer;
  }

  /** Список предложений тендера со сравнением и рекомендациями. */
  async compareTenderOffers(tenderId: string, user: RequestUser) {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      include: { project: true },
    });
    if (!tender) throw new NotFoundException('Тендер не найден');
    const isOwner =
      tender.project.customerId === user.sub || tender.project.coordinatorId === user.sub;
    const isStaff = [Role.COORDINATOR, Role.ADMIN, Role.SUPERADMIN].includes(user.role);
    if (!isOwner && !isStaff) throw new ForbiddenException('Нет доступа');

    const offers = await this.prisma.offer.findMany({
      where: { tenderId, status: { in: ['SUBMITTED', 'SHORTLISTED', 'ACCEPTED'] } },
      include: { provider: { include: { providerProfile: true } } },
    });

    const projectLat = tender.project.lat;
    const projectLng = tender.project.lng;

    const forScoring: OfferForScoring[] = offers.map((o) => {
      const profile = o.provider.providerProfile;
      let distanceKm: number | null = null;
      if (projectLat != null && projectLng != null && profile?.baseLat != null && profile?.baseLng != null) {
        distanceKm = this.haversineKm(projectLat, projectLng, profile.baseLat, profile.baseLng);
      }
      return {
        id: o.id,
        price: Number(o.price),
        durationDays: o.durationDays != null ? Number(o.durationDays) : null,
        availableDate: o.availableDate,
        warrantyMonths: o.warrantyMonths,
        provider: {
          ratingAvg: profile ? Number(profile.ratingAvg) : 0,
          reviewsCount: profile?.reviewsCount ?? 0,
          completedOrders: profile?.completedOrders ?? 0,
          cancelledOrders: profile?.cancelledOrders ?? 0,
          onTimeRate: profile ? Number(profile.onTimeRate) : 1,
          verified: profile?.verificationStatus === 'VERIFIED',
          distanceKm,
        },
      };
    });

    const scored = this.comparison.compare(forScoring);

    // Сохраняем посчитанный score в оффер
    await this.prisma.$transaction(
      scored.map((s) =>
        this.prisma.offer.update({
          where: { id: s.offerId },
          data: { score: new Prisma.Decimal(s.score) },
        }),
      ),
    );

    const byId = new Map(offers.map((o) => [o.id, o]));
    return {
      tender,
      legend: RECOMMENDATION_LABELS_RU,
      items: scored.map((s) => {
        const offer = byId.get(s.offerId)!;
        return {
          offer: {
            id: offer.id,
            price: Number(offer.price),
            durationDays: offer.durationDays != null ? Number(offer.durationDays) : null,
            availableDate: offer.availableDate,
            warrantyMonths: offer.warrantyMonths,
            comment: offer.comment,
            includes: offer.includes,
            excludes: offer.excludes,
            provider: {
              id: offer.provider.id,
              name:
                offer.provider.providerProfile?.companyName ??
                `${offer.provider.firstName ?? ''} ${offer.provider.lastName ?? ''}`.trim(),
              rating: offer.provider.providerProfile
                ? Number(offer.provider.providerProfile.ratingAvg)
                : 0,
              reviews: offer.provider.providerProfile?.reviewsCount ?? 0,
              verified: offer.provider.providerProfile?.verificationStatus === 'VERIFIED',
            },
          },
          score: s.score,
          breakdown: s.breakdown,
          recommendations: s.recommendations,
        };
      }),
    };
  }

  /** Выбор предложения: назначается исполнитель этапа, остальные офферы отклоняются. */
  async acceptOffer(offerId: string, user: RequestUser) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: { project: true, tender: true },
    });
    if (!offer) throw new NotFoundException('Предложение не найдено');
    const isOwner =
      offer.project.customerId === user.sub || offer.project.coordinatorId === user.sub;
    const isStaff = [Role.COORDINATOR, Role.ADMIN, Role.SUPERADMIN].includes(user.role);
    if (!isOwner && !isStaff) throw new ForbiddenException('Нет прав');

    await this.prisma.$transaction(async (tx) => {
      await tx.offer.update({ where: { id: offerId }, data: { status: 'ACCEPTED' } });
      await tx.offer.updateMany({
        where: { tenderId: offer.tenderId, id: { not: offerId }, status: 'SUBMITTED' },
        data: { status: 'REJECTED' },
      });
      await tx.tender.update({ where: { id: offer.tenderId }, data: { status: 'AWARDED' } });

      if (offer.stageId) {
        await tx.projectStage.update({
          where: { id: offer.stageId },
          data: {
            assigneeId: offer.providerId,
            estimatedCost: offer.price,
            plannedStart: offer.availableDate ?? undefined,
            status: 'SCHEDULED',
          },
        });
      }
    });

    await this.notifications.notify({
      userId: offer.providerId,
      type: 'OFFER' as any,
      projectId: offer.projectId,
      title: 'Ваше предложение принято',
      body: `Заказчик выбрал ваше предложение по «${offer.tender.title}»`,
    });
    await this.audit.log({
      actorId: user.sub,
      action: 'offer.accept',
      entityType: 'Offer',
      entityId: offerId,
    });
    return { success: true };
  }

  myOffers(user: RequestUser) {
    return this.prisma.offer.findMany({
      where: { providerId: user.sub },
      include: { tender: true, project: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}

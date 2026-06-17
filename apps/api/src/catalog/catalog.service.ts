import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listTemplates() {
    return this.prisma.projectTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        workType: true,
        coverUrl: true,
        _count: { select: { stageTemplates: true } },
      },
    });
  }

  async getTemplate(slug: string) {
    const template = await this.prisma.projectTemplate.findUnique({
      where: { slug },
      include: {
        questionnaire: {
          include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } },
        },
        stageTemplates: {
          orderBy: { order: 'asc' },
          include: {
            materials: { include: { material: true, quantityFormula: true } },
            specialists: { include: { specialist: true } },
            equipment: { include: { equipment: true } },
            risks: { include: { risk: true } },
            dependsOn: { include: { requires: { select: { code: true, name: true } } } },
          },
        },
      },
    });
    if (!template) throw new NotFoundException('Шаблон не найден');
    return template;
  }

  listRegions() {
    return this.prisma.region.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  listMaterialCategories() {
    return this.prisma.materialCategory.findMany({ orderBy: { name: 'asc' } });
  }

  listMaterials(categoryCode?: string) {
    return this.prisma.material.findMany({
      where: {
        isActive: true,
        ...(categoryCode ? { category: { code: categoryCode } } : {}),
      },
      include: { category: true, regionalPrices: { take: 1, orderBy: { validFrom: 'desc' } } },
      orderBy: { name: 'asc' },
    });
  }
}

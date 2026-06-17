import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';

@ApiTags('Каталог')
@ApiBearerAuth()
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('templates')
  @ApiOperation({ summary: 'Список шаблонов проектов' })
  templates() {
    return this.catalog.listTemplates();
  }

  @Get('templates/:slug')
  @ApiOperation({ summary: 'Шаблон с анкетой и этапами' })
  template(@Param('slug') slug: string) {
    return this.catalog.getTemplate(slug);
  }

  @Get('regions')
  @ApiOperation({ summary: 'Регионы' })
  regions() {
    return this.catalog.listRegions();
  }

  @Get('material-categories')
  @ApiOperation({ summary: 'Категории материалов' })
  categories() {
    return this.catalog.listMaterialCategories();
  }

  @Get('materials')
  @ApiOperation({ summary: 'Материалы' })
  materials(@Query('category') category?: string) {
    return this.catalog.listMaterials(category);
  }
}

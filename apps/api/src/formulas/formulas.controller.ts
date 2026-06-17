import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@razby/shared';
import { FormulasService } from './formulas.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { CreateFormulaDto, CreateFormulaVersionDto, DryRunDto } from './dto/formula.dto';

@ApiTags('Формулы')
@ApiBearerAuth()
@Controller('formulas')
export class FormulasController {
  constructor(private readonly formulas: FormulasService) {}

  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.COORDINATOR)
  @Get()
  @ApiOperation({ summary: 'Список формул со всеми версиями' })
  list() {
    return this.formulas.list();
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.COORDINATOR)
  @Get(':key')
  @ApiOperation({ summary: 'Формула по ключу' })
  get(@Param('key') key: string) {
    return this.formulas.getByKey(key);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Post()
  @ApiOperation({ summary: 'Создать формулу (версия 1)' })
  create(@Body() dto: CreateFormulaDto, @CurrentUser() user: RequestUser) {
    return this.formulas.create(dto, user.sub);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Post(':key/versions')
  @ApiOperation({ summary: 'Добавить новую версию формулы' })
  addVersion(
    @Param('key') key: string,
    @Body() dto: CreateFormulaVersionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.formulas.addVersion(key, dto, user.sub);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.COORDINATOR)
  @Post(':key/dry-run')
  @ApiOperation({ summary: 'Проверочный расчёт формулы без сохранения' })
  dryRun(@Param('key') key: string, @Body() dto: DryRunDto) {
    return this.formulas.dryRun(key, dto.inputs, dto.regionFactor ?? 1);
  }
}

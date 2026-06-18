import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@razby/shared';
import { AdminService } from './admin.service';
import { AiSettingsService } from '../ai-agent/ai-settings.service';
import { UpdateAiSettingsDto } from '../ai-agent/dto/ai-settings.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import {
  CreatePromoDto,
  SetRegionalPriceDto,
  SetSettingDto,
  SetUserBlockedDto,
  SetUserRoleDto,
  UpsertCommissionDto,
  UpsertRegionDto,
  VerifyProviderDto,
} from './dto/admin.dto';

@ApiTags('Администрирование')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPERADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly aiSettings: AiSettingsService,
  ) {}

  @Get('ai-settings')
  @ApiOperation({ summary: 'Настройки ИИ-агента (ключ маскируется)' })
  getAiSettings() {
    return this.aiSettings.getForAdmin();
  }

  @Put('ai-settings')
  @ApiOperation({ summary: 'Изменить настройки ИИ-агента (драйвер, модель, ключ)' })
  updateAiSettings(@Body() dto: UpdateAiSettingsDto, @CurrentUser() u: RequestUser) {
    return this.aiSettings.update(dto, u.sub);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Аналитика платформы' })
  analytics() {
    return this.admin.analytics();
  }

  @Get('users')
  @ApiOperation({ summary: 'Пользователи' })
  users(@Query('search') search?: string, @Query('role') role?: Role) {
    return this.admin.listUsers(search, role);
  }

  @Post('users/:id/role')
  @ApiOperation({ summary: 'Сменить роль' })
  setRole(@Param('id') id: string, @Body() dto: SetUserRoleDto, @CurrentUser() u: RequestUser) {
    return this.admin.setUserRole(id, dto.role, u.sub);
  }

  @Post('users/:id/blocked')
  @ApiOperation({ summary: 'Блокировка пользователя' })
  setBlocked(
    @Param('id') id: string,
    @Body() dto: SetUserBlockedDto,
    @CurrentUser() u: RequestUser,
  ) {
    return this.admin.setUserBlocked(id, dto.blocked, u.sub);
  }

  @Get('providers')
  @ApiOperation({ summary: 'Профили исполнителей' })
  providers(@Query('status') status?: string) {
    return this.admin.listProviders(status);
  }

  @Post('providers/:userId/verify')
  @ApiOperation({ summary: 'Проверка исполнителя' })
  verify(
    @Param('userId') userId: string,
    @Body() dto: VerifyProviderDto,
    @CurrentUser() u: RequestUser,
  ) {
    return this.admin.verifyProvider(userId, dto, u.sub);
  }

  @Get('audit')
  @ApiOperation({ summary: 'Журнал аудита' })
  audit(@Query('entityType') entityType?: string) {
    return this.admin.listAudit(entityType);
  }

  @Get('disputes')
  @ApiOperation({ summary: 'Споры' })
  disputes(@Query('status') status?: string) {
    return this.admin.listDisputes(status);
  }

  @Post('disputes/:id/resolve')
  @ApiOperation({ summary: 'Решение по спору' })
  resolve(
    @Param('id') id: string,
    @Body() body: { resolution: string; approve: boolean },
    @CurrentUser() u: RequestUser,
  ) {
    return this.admin.resolveDispute(id, body.resolution, body.approve, u.sub);
  }

  @Post('regions')
  @ApiOperation({ summary: 'Создать/обновить регион' })
  region(@Body() dto: UpsertRegionDto, @CurrentUser() u: RequestUser) {
    return this.admin.upsertRegion(dto, u.sub);
  }

  @Post('prices')
  @ApiOperation({ summary: 'Установить региональную цену' })
  price(@Body() dto: SetRegionalPriceDto, @CurrentUser() u: RequestUser) {
    return this.admin.setRegionalPrice(dto, u.sub);
  }

  @Post('commission')
  @ApiOperation({ summary: 'Правило комиссии' })
  commission(@Body() dto: UpsertCommissionDto, @CurrentUser() u: RequestUser) {
    return this.admin.upsertCommission(dto, u.sub);
  }

  @Get('promos')
  @ApiOperation({ summary: 'Промокоды' })
  promos() {
    return this.admin.listPromos();
  }

  @Post('promos')
  @ApiOperation({ summary: 'Создать промокод' })
  createPromo(@Body() dto: CreatePromoDto, @CurrentUser() u: RequestUser) {
    return this.admin.createPromo(dto, u.sub);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Системные настройки' })
  settings() {
    return this.admin.listSettings();
  }

  @Post('settings/:key')
  @ApiOperation({ summary: 'Изменить настройку' })
  setSetting(
    @Param('key') key: string,
    @Body() dto: SetSettingDto,
    @CurrentUser() u: RequestUser,
  ) {
    return this.admin.setSetting(key, dto.value, u.sub);
  }
}

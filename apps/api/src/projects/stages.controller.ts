import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StagesService } from './stages.service';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import {
  AcceptStageDto,
  RejectStageDto,
  ScheduleStageDto,
  UpdateChecklistDto,
} from './dto/stage.dto';

@ApiTags('Этапы')
@ApiBearerAuth()
@Controller('stages')
export class StagesController {
  constructor(
    private readonly stages: StagesService,
    private readonly projects: ProjectsService,
    private readonly prisma: PrismaService,
  ) {}

  private async guard(stageId: string, user: RequestUser) {
    const stage = await this.prisma.projectStage.findUnique({
      where: { id: stageId },
      select: { projectId: true },
    });
    if (stage) await this.projects.assertAccess(stage.projectId, user);
  }

  @Get(':id/readiness')
  @ApiOperation({ summary: 'Готовность этапа к старту (правила запуска)' })
  async readiness(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.guard(id, user);
    return this.stages.checkReadiness(id);
  }

  @Post(':id/schedule')
  @ApiOperation({ summary: 'Назначить исполнителя и даты' })
  async schedule(
    @Param('id') id: string,
    @Body() dto: ScheduleStageDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.guard(id, user);
    return this.stages.schedule(id, dto, user);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Начать этап' })
  async start(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.guard(id, user);
    return this.stages.start(id, user);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Отправить этап на приёмку' })
  async submit(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.guard(id, user);
    return this.stages.submitForReview(id, user);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Принять этап (акт)' })
  async accept(
    @Param('id') id: string,
    @Body() dto: AcceptStageDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.guard(id, user);
    return this.stages.accept(id, dto, user);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Отклонить приёмку этапа' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectStageDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.guard(id, user);
    return this.stages.reject(id, dto.reason, user);
  }

  @Post(':id/checklist')
  @ApiOperation({ summary: 'Обновить чек-лист этапа' })
  async checklist(
    @Param('id') id: string,
    @Body() dto: UpdateChecklistDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.guard(id, user);
    return this.stages.updateChecklist(id, dto.items, user);
  }

  @Post(':id/materials/ordered')
  @ApiOperation({ summary: 'Пометить материалы этапа заказанными' })
  async ordered(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.guard(id, user);
    return this.stages.markMaterialsOrdered(id);
  }
}

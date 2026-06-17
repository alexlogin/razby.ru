import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { CreateProjectDto, SaveAnswersDto } from './dto/project.dto';

@ApiTags('Проекты')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Создать проект' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: RequestUser) {
    return this.projects.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Список проектов пользователя' })
  list(@CurrentUser() user: RequestUser) {
    return this.projects.listForUser(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Полная карточка проекта' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.projects.getFull(id, user);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Сводка/дашборд проекта' })
  summary(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.projects.getSummary(id, user);
  }

  @Post(':id/answers')
  @ApiOperation({ summary: 'Сохранить ответы анкеты' })
  saveAnswers(
    @Param('id') id: string,
    @Body() dto: SaveAnswersDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projects.saveAnswers(id, dto, user);
  }

  @Post(':id/calculate')
  @ApiOperation({ summary: 'Рассчитать смету и сформировать этапы' })
  calculate(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.projects.calculate(id, user);
  }

  @Get(':id/estimate/history')
  @ApiOperation({ summary: 'История версий сметы' })
  estimateHistory(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.projects.getEstimateHistory(id, user);
  }
}

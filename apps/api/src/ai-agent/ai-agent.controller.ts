import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AiAgentService } from './ai-agent.service';
import { AnalyzeRequestDto } from './dto/ai-agent.dto';

@ApiTags('ИИ-агент')
@Controller('ai')
export class AiAgentController {
  constructor(private readonly aiAgent: AiAgentService) {}

  @Public()
  @Post('analyze')
  @ApiOperation({
    summary:
      'Разобрать свободный запрос: подобрать этапы и две оценки (по этапам / под ключ). Без регистрации.',
  })
  analyze(@Body() dto: AnalyzeRequestDto) {
    return this.aiAgent.analyze(dto);
  }
}

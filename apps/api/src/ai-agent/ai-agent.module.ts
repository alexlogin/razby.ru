import { Module } from '@nestjs/common';
import { FormulasModule } from '../formulas/formulas.module';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';
import { AiSettingsService } from './ai-settings.service';

@Module({
  imports: [FormulasModule],
  controllers: [AiAgentController],
  providers: [AiAgentService, AiSettingsService],
  exports: [AiSettingsService],
})
export class AiAgentModule {}

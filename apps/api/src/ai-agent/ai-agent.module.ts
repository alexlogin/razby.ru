import { Module } from '@nestjs/common';
import { FormulasModule } from '../formulas/formulas.module';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';

@Module({
  imports: [FormulasModule],
  controllers: [AiAgentController],
  providers: [AiAgentService],
})
export class AiAgentModule {}

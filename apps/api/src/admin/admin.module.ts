import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AiAgentModule } from '../ai-agent/ai-agent.module';

@Module({
  imports: [AiAgentModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

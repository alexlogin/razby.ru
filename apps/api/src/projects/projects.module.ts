import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { EstimateBuilderService } from './estimate-builder.service';
import { StagesService } from './stages.service';
import { StagesController } from './stages.controller';
import { FormulasModule } from '../formulas/formulas.module';

@Module({
  imports: [FormulasModule],
  controllers: [ProjectsController, StagesController],
  providers: [ProjectsService, EstimateBuilderService, StagesService],
  exports: [ProjectsService, EstimateBuilderService, StagesService],
})
export class ProjectsModule {}

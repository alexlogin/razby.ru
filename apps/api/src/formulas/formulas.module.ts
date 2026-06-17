import { Module } from '@nestjs/common';
import { FormulasService } from './formulas.service';
import { FormulaEvalService } from './formula-eval.service';
import { FormulasController } from './formulas.controller';

@Module({
  controllers: [FormulasController],
  providers: [FormulasService, FormulaEvalService],
  exports: [FormulasService, FormulaEvalService],
})
export class FormulasModule {}

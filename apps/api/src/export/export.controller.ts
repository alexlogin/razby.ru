import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ExportService } from './export.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

@ApiTags('Экспорт')
@ApiBearerAuth()
@Controller('projects/:id/estimate')
export class ExportController {
  constructor(private readonly exporter: ExportService) {}

  @Get('pdf')
  @ApiOperation({ summary: 'Экспорт сметы в PDF' })
  async pdf(@Param('id') id: string, @CurrentUser() user: RequestUser, @Res() res: Response) {
    const buffer = await this.exporter.toPdf(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="estimate-${id}.pdf"`);
    res.send(buffer);
  }

  @Get('excel')
  @ApiOperation({ summary: 'Экспорт сметы в Excel' })
  async excel(@Param('id') id: string, @CurrentUser() user: RequestUser, @Res() res: Response) {
    const buffer = await this.exporter.toExcel(id, user);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="estimate-${id}.xlsx"`);
    res.send(buffer);
  }
}

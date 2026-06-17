import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import type { RequestUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  private async loadEstimate(projectId: string, user: RequestUser) {
    await this.projects.assertAccess(projectId, user);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        estimates: { where: { isCurrent: true }, include: { items: true } },
        region: true,
      },
    });
    if (!project || project.estimates.length === 0) {
      throw new NotFoundException('Смета ещё не рассчитана');
    }
    return { project, estimate: project.estimates[0] };
  }

  async toPdf(projectId: string, user: RequestUser): Promise<Buffer> {
    const { project, estimate } = await this.loadEstimate(projectId, user);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));

    doc.fontSize(18).text('Razby.ru — Смета проекта', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#555').text(`Проект: ${project.title}`);
    doc.text(`Регион: ${project.region?.name ?? '—'}`);
    doc.text(`Версия сметы: ${estimate.version} от ${estimate.createdAt.toLocaleDateString('ru-RU')}`);
    doc.fillColor('#000').moveDown(0.8);

    const fmt = (v: unknown) => Number(v).toLocaleString('ru-RU', { minimumFractionDigits: 2 });

    doc.fontSize(12).text('Позиции:', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10);
    for (const item of estimate.items) {
      doc.text(
        `• [${item.kind}] ${item.title} — ${fmt(item.quantity)} ${item.unit ?? ''} × ${fmt(item.unitPrice)} = ${fmt(item.total)} ₽`,
      );
    }

    doc.moveDown(0.8);
    doc.fontSize(11);
    doc.text(`Материалы: ${fmt(estimate.materialsCost)} ₽`);
    doc.text(`Работы: ${fmt(estimate.worksCost)} ₽`);
    doc.text(`Логистика: ${fmt(estimate.logisticsCost)} ₽`);
    doc.text(`Комиссия платформы: ${fmt(estimate.commission)} ₽`);
    doc.moveDown(0.3);
    doc.fontSize(14).fillColor('#0a7').text(`ИТОГО: ${fmt(estimate.total)} ₽`);
    doc.fillColor('#000').fontSize(10).moveDown(0.3);
    doc.text(`Оценка «под ключ» одной компанией: ${fmt(estimate.turnkeyTotal)} ₽`);
    doc.fillColor('#c33').text(
      `Потенциальная экономия с Razby.ru: ${fmt(Math.max(Number(estimate.turnkeyTotal) - Number(estimate.total), 0))} ₽`,
    );

    doc.end();
    await new Promise<void>((resolve) => doc.on('end', () => resolve()));
    return Buffer.concat(chunks);
  }

  async toExcel(projectId: string, user: RequestUser): Promise<Buffer> {
    const { project, estimate } = await this.loadEstimate(projectId, user);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Razby.ru';
    const ws = wb.addWorksheet('Смета');

    ws.mergeCells('A1:E1');
    ws.getCell('A1').value = `Смета проекта: ${project.title} (версия ${estimate.version})`;
    ws.getCell('A1').font = { bold: true, size: 14 };

    ws.addRow([]);
    const header = ws.addRow(['Тип', 'Наименование', 'Кол-во', 'Цена за ед.', 'Сумма, ₽']);
    header.font = { bold: true };
    header.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    });

    for (const item of estimate.items) {
      ws.addRow([
        item.kind,
        item.title,
        Number(item.quantity),
        Number(item.unitPrice),
        Number(item.total),
      ]);
    }

    ws.addRow([]);
    ws.addRow(['', 'Материалы', '', '', Number(estimate.materialsCost)]);
    ws.addRow(['', 'Работы', '', '', Number(estimate.worksCost)]);
    ws.addRow(['', 'Логистика', '', '', Number(estimate.logisticsCost)]);
    ws.addRow(['', 'Комиссия', '', '', Number(estimate.commission)]);
    const total = ws.addRow(['', 'ИТОГО', '', '', Number(estimate.total)]);
    total.font = { bold: true };
    ws.addRow(['', 'Под ключ (оценка)', '', '', Number(estimate.turnkeyTotal)]);
    ws.addRow([
      '',
      'Экономия',
      '',
      '',
      Math.max(Number(estimate.turnkeyTotal) - Number(estimate.total), 0),
    ]);

    ws.columns.forEach((col) => {
      col.width = 22;
    });
    ws.getColumn(2).width = 45;

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

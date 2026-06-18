import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { DocumentType } from '@razby/shared';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../providers/storage/storage.provider';

@ApiTags('Загрузки')
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  private validate(file: Express.Multer.File): void {
    if (!file) throw new BadRequestException('Файл не передан');
    const allowed = this.config.get<string[]>('app.uploads.allowedMime')!;
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(`Недопустимый тип файла: ${file.mimetype}`);
    }
    const maxBytes = this.config.get<number>('app.uploads.maxFileSizeMb')! * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException('Файл превышает допустимый размер');
    }
  }

  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @Post('document')
  @ApiOperation({ summary: 'Загрузка документа' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Body('type') type?: string,
    @Body('title') title?: string,
    @Body('projectId') projectId?: string,
  ) {
    this.validate(file);
    const key = `documents/${user.sub}/${randomUUID()}${extname(file.originalname) || ''}`;
    const { url } = await this.storage.putObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const doc = await this.prisma.document.create({
      data: {
        ownerId: user.sub,
        type: (type as DocumentType) ?? DocumentType.OTHER,
        title: title ?? file.originalname,
        storageKey: key,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        projectId: projectId || null,
      },
    });
    return { ...doc, url };
  }

  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @Post('image')
  @ApiOperation({ summary: 'Загрузка изображения (фото)' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    this.validate(file);
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Ожидается изображение');
    }
    const key = `photos/${user.sub}/${randomUUID()}${extname(file.originalname) || '.jpg'}`;
    const { url } = await this.storage.putObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });
    return { key, url };
  }

  /** Прямой приём файла для mock-хранилища (используется presignUpload). */
  @Public()
  @Post('direct')
  @UseInterceptors(FileInterceptor('file'))
  async direct(
    @UploadedFile() file: Express.Multer.File,
    @Query('key') key: string,
    @Req() _req: Request,
    @Res() res: Response,
  ) {
    this.validate(file);
    if (!key) throw new BadRequestException('Не указан key');
    await this.storage.putObject({ key, body: file.buffer, contentType: file.mimetype });
    res.json({ key, url: this.storage.getPublicUrl(key) });
  }
}

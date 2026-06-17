import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@razby/shared';
import { OffersService } from './offers.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { CreateTenderDto, SubmitOfferDto } from './dto/offer.dto';

@ApiTags('Тендеры и предложения')
@ApiBearerAuth()
@Controller()
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Post('tenders')
  @ApiOperation({ summary: 'Создать тендер по проекту/этапу' })
  createTender(@Body() dto: CreateTenderDto, @CurrentUser() user: RequestUser) {
    return this.offers.createTender(dto, user);
  }

  @Roles(Role.CONTRACTOR, Role.SUPPLIER, Role.CARRIER)
  @Get('tenders/open')
  @ApiOperation({ summary: 'Открытые тендеры для исполнителя' })
  open(@CurrentUser() user: RequestUser) {
    return this.offers.listOpenForProvider(user);
  }

  @Roles(Role.CONTRACTOR, Role.SUPPLIER, Role.CARRIER)
  @Post('tenders/:id/offers')
  @ApiOperation({ summary: 'Подать/обновить предложение' })
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitOfferDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.offers.submitOffer(id, dto, user);
  }

  @Get('tenders/:id/compare')
  @ApiOperation({ summary: 'Сравнение предложений тендера с рекомендациями' })
  compare(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.offers.compareTenderOffers(id, user);
  }

  @Post('offers/:id/accept')
  @ApiOperation({ summary: 'Выбрать предложение' })
  accept(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.offers.acceptOffer(id, user);
  }

  @Roles(Role.CONTRACTOR, Role.SUPPLIER, Role.CARRIER)
  @Get('offers/my')
  @ApiOperation({ summary: 'Мои предложения' })
  my(@CurrentUser() user: RequestUser) {
    return this.offers.myOffers(user);
  }
}

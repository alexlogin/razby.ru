import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { ComparisonService } from './comparison.service';

@Module({
  controllers: [OffersController],
  providers: [OffersService, ComparisonService],
  exports: [OffersService, ComparisonService],
})
export class OffersModule {}

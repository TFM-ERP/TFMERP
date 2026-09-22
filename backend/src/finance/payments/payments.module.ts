import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { SlipReaderService } from './slip-reader.service';

@Module({
  providers: [PaymentsService, SlipReaderService],
  controllers: [PaymentsController],
  exports: [PaymentsService, SlipReaderService],
})
export class PaymentsModule {}

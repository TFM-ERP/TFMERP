import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { SlipReaderService } from './slip-reader.service';
import { SupplierPaymentsService } from './supplier-payments.service';

@Module({
  providers: [PaymentsService, SlipReaderService, SupplierPaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService, SlipReaderService, SupplierPaymentsService],
})
export class PaymentsModule {}

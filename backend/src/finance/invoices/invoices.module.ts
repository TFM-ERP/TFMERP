import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { CollectionsModule } from '../../collections/collections.module';

@Module({
  // CollectionsModule exports EmailService, which owns the company SMTP
  // settings. Sharing an invoice reuses it rather than opening a second path
  // out of the system.
  imports: [CollectionsModule],
  providers: [InvoicesService],
  controllers: [InvoicesController],
  exports: [InvoicesService],
})
export class InvoicesModule {}

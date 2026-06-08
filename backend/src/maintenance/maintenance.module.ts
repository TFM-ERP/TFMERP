import { Module } from '@nestjs/common';
import { VendorsModule } from './vendors/vendors.module';
import { JobsModule } from './jobs/jobs.module';
import { PartsModule } from './parts/parts.module';
import { TiresModule } from './tires/tires.module';
import { InvoicesModule } from './invoices/invoices.module';

@Module({
  imports: [VendorsModule, JobsModule, PartsModule, TiresModule, InvoicesModule],
  exports: [VendorsModule, JobsModule, PartsModule, TiresModule, InvoicesModule],
})
export class MaintenanceModule {}

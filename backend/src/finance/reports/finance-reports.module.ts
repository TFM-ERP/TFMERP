import { Module } from '@nestjs/common';
import { FinanceReportsService } from './finance-reports.service';
import { FinanceReportsController } from './finance-reports.controller';

@Module({
  providers: [FinanceReportsService],
  controllers: [FinanceReportsController],
})
export class FinanceReportsModule {}

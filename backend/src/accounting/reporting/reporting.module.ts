import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ReportingController, TaxReportingController, PeriodControlController } from './reporting.controller';
import { StatementsService } from './statements.service';
import { CorporateTaxService } from './corporate-tax.service';
import { Vat201Service } from './vat201.service';
import { FafService } from './faf.service';
import { StatementsDocxService } from './statements-docx.service';
import { ManagementReportsService } from './management-reports.service';
import { DepreciationService } from './depreciation.service';
import { PeriodsService } from './periods.service';

/**
 * Statutory and management reporting.
 *
 * Kept as its own module rather than added to AccountingModule: accounting.service.ts
 * is already 28KB and does chart of accounts, journals, trial balance, bank
 * reconciliation and auto-posting. Reporting reads the ledger and never writes to
 * it, so it has a clean boundary of its own.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ReportingController, TaxReportingController, PeriodControlController],
  providers: [StatementsService, CorporateTaxService, Vat201Service, FafService, StatementsDocxService, ManagementReportsService, DepreciationService, PeriodsService],
  exports: [StatementsService, CorporateTaxService, Vat201Service, FafService, StatementsDocxService, ManagementReportsService, DepreciationService, PeriodsService],
})
export class ReportingModule {}

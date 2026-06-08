import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FinanceReportsService } from './finance-reports.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance/reports')
export class FinanceReportsController {
  constructor(private service: FinanceReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Finance dashboard: YTD revenue, outstanding, recent invoices' })
  dashboard() { return this.service.getDashboardSummary(); }

  @Get('revenue-by-activity')
  @ApiOperation({ summary: 'Monthly revenue breakdown by activity for a given year' })
  revenueByActivity(@Query('year') year: string) {
    return this.service.getRevenueByActivity(parseInt(year) || new Date().getFullYear());
  }

  @Get('outstanding-by-client')
  @ApiOperation({ summary: 'Top clients by outstanding balance' })
  outstandingByClient() { return this.service.getOutstandingByClient(); }

  @Get('vat-return')
  @ApiOperation({ summary: 'UAE VAT 201 return — output/input VAT for a period' })
  vatReturn(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.service.getVatReturn(startDate, endDate);
  }
}

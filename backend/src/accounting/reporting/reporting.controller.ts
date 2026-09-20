import { Controller, Get, Post, Patch, Body, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';
import { StatementsService } from './statements.service';
import { CorporateTaxService } from './corporate-tax.service';
import { Vat201Service } from './vat201.service';
import { FafService } from './faf.service';
import { StatementsDocxService } from './statements-docx.service';
import { ManagementReportsService } from './management-reports.service';
import { DepreciationService } from './depreciation.service';
import { PeriodsService } from './periods.service';
import { COMPANY_PROFILE } from './company-profile';

/**
 * Statutory and management reporting, read-only.
 *
 * Every endpoint here computes from posted journal lines. Nothing in this
 * controller writes, so it is safe to expose at read permission level alongside
 * the trial balance and general ledger.
 */
@ApiTags('Accounting — Reporting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('finance', 1)
@Controller('accounting/reports')
export class ReportingController {
  constructor(
    private statements: StatementsService,
    private docx: StatementsDocxService,
    private management: ManagementReportsService,
  ) {}

  @Get('income-statement')
  @ApiOperation({ summary: 'Income statement for a period, with prior-period comparative' })
  incomeStatement(@Query() q: { from?: string; to: string; comparative?: string }) {
    return this.statements.incomeStatement({
      from: q.from ?? null,
      to: q.to,
      comparative: q.comparative !== 'false',
    });
  }

  @Get('financial-position')
  @ApiOperation({ summary: 'Statement of financial position as at a date' })
  financialPosition(@Query() q: { asAt: string; comparative?: string }) {
    return this.statements.statementOfFinancialPosition({
      asAt: q.asAt,
      comparative: q.comparative !== 'false',
    });
  }

  @Get('changes-in-equity')
  @ApiOperation({ summary: 'Statement of changes in equity for a period' })
  changesInEquity(@Query() q: { from: string; to: string }) {
    return this.statements.statementOfChangesInEquity({ from: q.from, to: q.to });
  }

  @Get('cash-flows')
  @ApiOperation({ summary: 'Statement of cash flows for a period, indirect method' })
  cashFlows(@Query() q: { from: string; to: string }) {
    return this.statements.statementOfCashFlows({ from: q.from, to: q.to });
  }

  @Get('full-set')
  @ApiOperation({ summary: 'Complete set of financial statements for a year, with integrity checks' })
  fullSet(@Query() q: { year: string; comparative?: string }) {
    return this.statements.fullSet({
      year: Number(q.year),
      comparative: q.comparative !== 'false',
    });
  }

  @Get('aged-receivables')
  @ApiOperation({ summary: 'Outstanding customer invoices, aged, reconciled to account 1100' })
  agedReceivables(@Query() q: { asAt?: string }) {
    return this.management.agedReceivables(q.asAt ? new Date(q.asAt) : undefined);
  }

  @Get('aged-payables')
  @ApiOperation({ summary: 'Supplier balances, aged, reconciled to account 2000' })
  agedPayables(@Query() q: { asAt?: string }) {
    return this.management.agedPayables(q.asAt ? new Date(q.asAt) : undefined);
  }

  @Get('executive-summary')
  @ApiOperation({ summary: 'Margins, working capital, cash runway and ageing on one page' })
  executiveSummary(@Query() q: { year: string }) {
    return this.management.executiveSummary(Number(q.year));
  }

  /**
   * The statements as a Word document, generated from the same figures the
   * endpoints above return. This is the file the auditor and the licensing
   * authority receive.
   */
  @Get('full-set.docx')
  @ApiOperation({ summary: 'Download the complete financial statements as a Word document' })
  async fullSetDocx(
    @Query() q: { year: string; draft?: string; letterhead?: string; trn?: string; licence?: string },
    @Res() res: Response,
  ) {
    const { filename, buffer } = await this.docx.build({
      year: Number(q.year),
      draft: q.draft !== 'false',
      letterheadPath: q.letterhead,
      trn: q.trn,
      licence: q.licence,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}

/**
 * Tax reporting. Separate controller so the statutory statements and the tax
 * returns can carry different permission levels later without disturbing either.
 */
@ApiTags('Accounting — Tax')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('finance', 1)
@Controller('accounting/tax')
export class TaxReportingController {
  constructor(
    private corporateTax: CorporateTaxService,
    private vat: Vat201Service,
    private faf: FafService,
  ) {}

  @Get('vat201')
  @ApiOperation({ summary: 'VAT 201 return for a period, all fifteen boxes, reconciled to the ledger' })
  vat201(@Query() q: { from: string; to: string }) {
    return this.vat.return201({ from: q.from, to: q.to });
  }

  @Get('vat201/year')
  @ApiOperation({ summary: 'All four quarterly VAT 201 returns for a year' })
  vat201Year(@Query() q: { year: string }) {
    return this.vat.year(Number(q.year));
  }

  @Get('corporate-tax')
  @ApiOperation({ summary: 'Corporate tax computation for a tax period, reconciled to the financial statements' })
  corporateTaxComputation(
    @Query() q: { year: string; electSmallBusinessRelief?: string; lossesBroughtForward?: string },
  ) {
    return this.corporateTax.computation({
      year: Number(q.year),
      electSmallBusinessRelief: q.electSmallBusinessRelief === 'true',
      lossesBroughtForward: q.lossesBroughtForward ? Number(q.lossesBroughtForward) : 0,
    });
  }

  @Get('corporate-tax/revenue-reconciliation')
  @ApiOperation({ summary: 'Ledger revenue against the sales invoices for the year' })
  revenueReconciliation(@Query() q: { year: string }) {
    return this.corporateTax.revenueReconciliation(Number(q.year));
  }

  @Get('faf')
  @ApiOperation({ summary: 'FTA Audit File (FAF) for a period, at invoice level' })
  auditFile(@Query() q: { from: string; to: string; trn?: string }) {
    return this.faf.generate({
      from: q.from,
      to: q.to,
      company: {
        nameEn: COMPANY_PROFILE.nameEn,
        // The FAF header has a dedicated Arabic-name column; leaving it blank is
        // an incomplete submission.
        nameAr: COMPANY_PROFILE.nameAr,
        trn: q.trn ?? COMPANY_PROFILE.trn,
      },
    });
  }
}

/**
 * Period control and the depreciation run — the two things that write.
 *
 * Kept apart from the read-only reporting controllers and held at a higher
 * permission level: closing a period stops other people posting, and a
 * depreciation run books a journal.
 */
@ApiTags('Accounting — Period Control')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('finance', 2)
@Controller('accounting/periods')
export class PeriodControlController {
  constructor(
    private periods: PeriodsService,
    private depreciation: DepreciationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Accounting periods and whether each is open or closed' })
  list(@Query() q: { year?: string }) {
    return this.periods.list(q.year ? Number(q.year) : undefined);
  }

  @Post('open-year')
  @ApiOperation({ summary: 'Create the months, quarters and year for a financial year, all open' })
  openYear(@Body() body: { year: number }) {
    return this.periods.openYear(Number(body.year));
  }

  @Patch(':id/close')
  @ApiOperation({ summary: 'Close a period. Refuses while draft journals remain inside it.' })
  close(@Param('id') id: string, @Req() req: any) {
    return this.periods.close(id, req?.user?.id);
  }

  @Patch(':id/reopen')
  @ApiOperation({ summary: 'Reopen a closed period' })
  reopen(@Param('id') id: string) {
    return this.periods.reopen(id);
  }

  @Get('depreciation/preview')
  @ApiOperation({ summary: 'What depreciation would be charged for a period. Posts nothing.' })
  previewDepreciation(@Query() q: { from: string; to: string }) {
    return this.depreciation.preview({ from: q.from, to: q.to });
  }

  @Post('depreciation/run')
  @ApiOperation({ summary: 'Post the depreciation charge for a period. Refuses to run twice.' })
  runDepreciation(@Body() body: { from: string; to: string }) {
    return this.depreciation.run({ from: body.from, to: body.to });
  }
}

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Compliance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('compliance')
export class ComplianceController {
  constructor(private service: ComplianceService) {}

  @Get('renewals')
  @ApiOperation({ summary: 'All document/licence expiries with status (renewals dashboard)' })
  renewals() { return this.service.renewals(); }

  @Get('einvoicing')
  @ApiOperation({ summary: 'UAE e-invoicing readiness checklist, score and rollout timeline' })
  einvoicing() { return this.service.einvoicingReadiness(); }

  @Get('einvoicing/invoice/:id')
  @ApiOperation({ summary: 'Structured (PINT-AE-style) representation of an invoice for ASP export' })
  invoicePeppol(@Param('id') id: string) { return this.service.invoicePeppol(id); }
}

import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('contracts')
export class ContractsController {
  constructor(private service: ContractsService) {}

  // Masters
  @Get('templates') templates() { return this.service.listTemplates(); }
  @Get('templates/:id') template(@Param('id') id: string) { return this.service.getTemplate(id); }
  @Post('templates') @RequirePermission('production', 2) addTemplate(@Body() b: any, @Req() r: any) { return this.service.createTemplate(b, r.user?.id); }
  @Put('templates/:id') @RequirePermission('production', 2) updTemplate(@Param('id') id: string, @Body() b: any) { return this.service.updateTemplate(id, b); }
  @Get('clauses') clauses() { return this.service.listClauses(); }
  @Post('clauses') @RequirePermission('production', 2) addClause(@Body() b: any) { return this.service.createClause(b); }

  // Project contracts
  @Get('dashboard') dashboard() { return this.service.dashboard(); }
  @Get() list(@Query('projectId') projectId?: string, @Query('scope') scope?: string) { return this.service.listContracts({ projectId, scope }); }
  @Get(':id') get(@Param('id') id: string) { return this.service.getContract(id); }
  @Post('generate') @RequirePermission('production', 2) generate(@Body() b: any, @Req() r: any) { return this.service.generateFromTemplate(b, r.user?.id); }
  @Post(':id/send') @RequirePermission('production', 2) send(@Param('id') id: string, @Body() b: any, @Req() r: any) { return this.service.sendForSignature(id, b, r.user?.id); }
  @Post(':id/mark-signed') @RequirePermission('production', 2) markSigned(@Param('id') id: string, @Req() r: any) { return this.service.markSigned(id, r.user?.id); }
}

/**
 * Public DocuSign-style webhook. No auth guard (provider callback) — in
 * production verify the provider HMAC signature header before trusting the body.
 */
@ApiTags('Contracts')
@Controller('contracts/webhooks')
export class ContractsWebhookController {
  constructor(private service: ContractsService) {}

  @Post('esign') esign(@Body() body: any) { return this.service.handleEsignWebhook(body); }
}

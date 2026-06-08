import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CrmService } from './crm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('crm')
export class CrmController {
  constructor(private service: CrmService) {}

  @Get('pipeline') pipeline() { return this.service.pipeline(); }

  @Get('leads') leads(@Query() q: any) { return this.service.leads(q); }
  @Post('leads') createLead(@Body() b: any) { return this.service.createLead(b); }
  @Put('leads/:id') updateLead(@Param('id') id: string, @Body() b: any) { return this.service.updateLead(id, b); }
  @Delete('leads/:id') removeLead(@Param('id') id: string) { return this.service.removeLead(id); }
  @Post('leads/:id/convert') convertLead(@Param('id') id: string, @Body() b: any) { return this.service.convertLead(id, b); }

  @Get('opportunities') opps(@Query() q: any) { return this.service.opportunitiesEnriched(q); }
  @Post('opportunities') createOpp(@Body() b: any) { return this.service.createOpportunity(b); }
  @Put('opportunities/:id') updateOpp(@Param('id') id: string, @Body() b: any) { return this.service.updateOpportunity(id, b); }
  @Patch('opportunities/:id/stage') setStage(@Param('id') id: string, @Body() b: { stage: string; lostReason?: string }) { return this.service.setStage(id, b.stage, b.lostReason); }
  @Delete('opportunities/:id') removeOpp(@Param('id') id: string) { return this.service.removeOpportunity(id); }
  @Post('opportunities/:id/quotation') toQuotation(@Param('id') id: string, @Request() req) { return this.service.convertToQuotation(id, req.user.id); }
}

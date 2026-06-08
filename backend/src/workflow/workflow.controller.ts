import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WorkflowService } from './workflow.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Workflow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workflow')
export class WorkflowController {
  constructor(private service: WorkflowService) {}

  // Definitions
  @Get('definitions') definitions(@Query('entityType') entityType?: string) { return this.service.listDefinitions(entityType); }
  @Put('definitions') upsertDefinition(@Body() body: any) { return this.service.upsertDefinition(body); }

  // Instances
  @Post('start') start(@Body() body: any, @Req() req: any) { return this.service.start(body, req.user?.id); }
  @Get('instance/:id') instance(@Param('id') id: string) { return this.service.instance(id); }
  @Get('entity/:entityType/:entityId') forEntity(@Param('entityType') et: string, @Param('entityId') id: string) { return this.service.forEntity(et, id); }
  @Post('instance/:id/approve') approve(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.act(id, req.user?.id, 'APPROVE', b?.comment); }
  @Post('instance/:id/reject') reject(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.act(id, req.user?.id, 'REJECT', b?.comment); }
  @Post('instance/:id/cancel') cancel(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.cancel(id, req.user?.id, b?.comment); }

  // My approval inbox
  @Get('my-pending') myPending(@Req() req: any) { return this.service.myPending(req.user?.id); }
}

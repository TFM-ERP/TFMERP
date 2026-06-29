import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { LlmRoutingService } from './llm-routing.service';

const Auth = () => UseGuards(JwtAuthGuard, PermissionsGuard);

/**
 * LLM Engines & Routing (admin) — the text-side switchboard, mirroring the
 * `production/audio` engines controller. Reads require production:1; mutations
 * require production:2. No raw keys are ever returned (only env-var references).
 */
@ApiTags('AI') @ApiBearerAuth() @Auth() @RequirePermission('production', 1)
@Controller('production/ai')
export class LlmEnginesController {
  constructor(private llm: LlmRoutingService) {}

  @Get('engines') list() { return this.llm.listEngines(); }
  @Get('engines/:key/status') status(@Param('key') key: string) { return this.llm.engineStatus(key); }
  @Get('health') health() { return this.llm.health(); }
  @Post('engines/seed') @RequirePermission('production', 2) seed() { return this.llm.seedDefaults(); }
  @Post('engines') @RequirePermission('production', 2) create(@Body() b: any) { return this.llm.createEngine(b); }
  @Put('engines/:id') @RequirePermission('production', 2) update(@Param('id') id: string, @Body() b: any) { return this.llm.updateEngine(id, b); }
  @Delete('engines/:id') @RequirePermission('production', 2) remove(@Param('id') id: string) { return this.llm.removeEngine(id); }

  @Get('routing') getRouting(@Query('scope') scope = 'ORG', @Query('projectId') projectId?: string) { return this.llm.getRouting(scope, projectId); }
  @Put('routing/:capability') @RequirePermission('production', 2) setRouting(@Param('capability') c: string, @Body() b: any, @Req() req: any) { return this.llm.setRouting(c, { ...b, userId: req.user?.id }); }
  @Get('routing-resolved') resolveAll(@Query('projectId') projectId?: string) { return this.llm.resolveAll(projectId); }

  @Get('runs') runs(@Query('hours') hours?: string, @Query('limit') limit?: string, @Query('projectId') projectId?: string, @Query('surface') surface?: string, @Query('status') status?: string, @Query('size') size?: string) {
    return this.llm.recentRuns({ hours: hours ? Number(hours) : undefined, limit: limit ? Number(limit) : undefined, projectId, surface, status, size });
  }
}

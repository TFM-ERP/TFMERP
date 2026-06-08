import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AssessmentService } from './assessment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';

@ApiTags('Location Assessment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('location-assessment')
export class AssessmentController {
  constructor(private service: AssessmentService) {}

  // Tech recces
  @Get('recces/:locationId') listRecces(@Param('locationId') locationId: string) { return this.service.listRecces(locationId); }
  @Post('recces/:locationId') @RequirePermission('production', 2)
  createRecce(@Param('locationId') locationId: string, @Body() b: any, @Req() req: any) { return this.service.createRecce(locationId, b, req.user?.id); }
  @Put('recces/:id') @RequirePermission('production', 2)
  updateRecce(@Param('id') id: string, @Body() b: any) { return this.service.updateRecce(id, b); }
  @Post('recces/:id/notes') @RequirePermission('production', 2)
  upsertNote(@Param('id') id: string, @Body() b: any) { return this.service.upsertNote(id, b); }
  @Delete('notes/:id') @RequirePermission('production', 2)
  removeNote(@Param('id') id: string) { return this.service.removeNote(id); }
  @Post('notes/:id/toggle') @RequirePermission('production', 2)
  toggleNote(@Param('id') id: string, @Body() b: any) { return this.service.toggleNote(id, !!b?.resolved); }

  // Department recce rollup + checklist template (SYS-07 V2 · Slice 5)
  @Get('rollup/:locationId') rollup(@Param('locationId') locationId: string) { return this.service.recceRollup(locationId); }
  @Get('checklist') checklist(@Query('department') department?: string) { return this.service.checklistTemplate(department); }

  // Evaluations
  @Get('evaluations/:locationId') listEvals(@Param('locationId') locationId: string) { return this.service.listEvaluations(locationId); }
  @Post('evaluations/:locationId') @RequirePermission('production', 2)
  upsertEval(@Param('locationId') locationId: string, @Body() b: any, @Req() req: any) { return this.service.upsertEvaluation(locationId, b, req.user?.id); }

  // Project-level comparison + printable pack
  @Get('compare/:projectId') compare(@Param('projectId') projectId: string) { return this.service.compareProject(projectId); }
  @Get('pack/:projectId') pack(@Param('projectId') projectId: string) { return this.service.packProject(projectId); }
}

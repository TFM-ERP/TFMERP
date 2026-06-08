import { Controller, Get, Post, Put, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ScoutingService } from './scouting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';

@ApiTags('Scouting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('scouting')
export class ScoutingController {
  constructor(private service: ScoutingService) {}

  // Assignments
  @Get('assignments') listAssignments(@Query() q: any) { return this.service.listAssignments(q); }
  @Get('assignments/:id') getAssignment(@Param('id') id: string) { return this.service.getAssignment(id); }
  @Post('assignments') @RequirePermission('production', 2)
  createAssignment(@Body() b: any, @Req() req: any) { return this.service.createAssignment(b, req.user?.id); }
  @Put('assignments/:id') @RequirePermission('production', 2)
  updateAssignment(@Param('id') id: string, @Body() b: any) { return this.service.updateAssignment(id, b); }

  // Submissions
  @Post('assignments/:id/submissions')
  createSubmission(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.createSubmission(id, b, req.user?.id); }
  @Patch('submissions/:id/status') @RequirePermission('production', 2)
  setStatus(@Param('id') id: string, @Body() b: any) { return this.service.setSubmissionStatus(id, b?.status, b?.reviewNotes); }
  @Post('submissions/:id/accept') @RequirePermission('production', 2)
  accept(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.acceptSubmission(id, { linkToProject: !!b?.linkToProject }, req.user?.id); }
}

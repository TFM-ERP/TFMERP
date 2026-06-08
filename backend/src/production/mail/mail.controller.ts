import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MailService } from './mail.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/mail')
export class MailController {
  constructor(private service: MailService) {}

  @Get('status') status() { return this.service.status(); }
  @Get('settings') getSettings() { return this.service.getSettings(); }
  @Put('settings') saveSettings(@Body() body: any) { return this.service.saveSettings(body); }
  @Post('test') test(@Body() body: any) { return this.service.testSettings(body?.to); }
  @Get('settings/project/:projectId') getProjectSettings(@Param('projectId') projectId: string) { return this.service.getProjectSettings(projectId); }
  @Put('settings/project/:projectId') saveProjectSettings(@Param('projectId') projectId: string, @Body() body: any) { return this.service.saveProjectSettings(projectId, body); }
  @Post('test/project/:projectId') testProject(@Param('projectId') projectId: string, @Body() body: any) { return this.service.testProjectSettings(projectId, body?.to); }
  @Post('callsheet/:id') callsheet(@Param('id') id: string, @Body() body: any) { return this.service.sendCallSheet(id, body); }
  @Post('cost-report/:projectId') costReport(@Param('projectId') projectId: string, @Body() body: any) { return this.service.sendCostReport(projectId, body); }
  @Post('deal-memo/:assignmentId') dealMemo(@Param('assignmentId') assignmentId: string, @Body() body: any) { return this.service.sendDealMemo(assignmentId, body); }
  @Post('send-breakdown/:projectId') sendBreakdown(@Param('projectId') projectId: string, @Body() body: any) { return this.service.sendBreakdown(projectId, body); }
}

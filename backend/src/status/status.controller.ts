import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { StatusService } from './status.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StatusModule } from './workflow.config';

@UseGuards(JwtAuthGuard)
@Controller('status')
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  /** GET /status/history?module=Invoice&recordId=xyz */
  @Get('history')
  getHistory(
    @Query('module') module: StatusModule,
    @Query('recordId') recordId: string,
  ) {
    return this.statusService.getHistory(module, recordId);
  }

  /** GET /status/recent — for notification center */
  @Get('recent')
  getRecent(@Query('limit') limit?: string) {
    return this.statusService.getRecent(limit ? parseInt(limit) : 20);
  }

  /** GET /status/pending-approvals */
  @Get('pending-approvals')
  getPendingApprovals() {
    return this.statusService.getPendingApprovals();
  }

  /** GET /status/kanban?module=Invoice */
  @Get('kanban')
  getKanbanData(@Query('module') module: StatusModule) {
    return this.statusService.getKanbanData(module);
  }

  /** GET /status/kpi */
  @Get('kpi')
  getKpiData() {
    return this.statusService.getKpiData();
  }

  /** GET /status/analytics?module=Invoice */
  @Get('analytics')
  getAnalytics(@Query('module') module: StatusModule) {
    return this.statusService.getStatusDurationAnalytics(module);
  }
}

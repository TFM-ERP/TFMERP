import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LogisticsReportsService } from './logistics-reports.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Logistics Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('logistics/reports')
export class LogisticsReportsController {
  constructor(private service: LogisticsReportsService) {}

  @Get('summary') summary(@Query('projectId') projectId: string) { return this.service.summary(projectId); }
  @Get('overview') overview() { return this.service.overview(); }
}

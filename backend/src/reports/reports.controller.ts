import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get('catalog')
  catalog() { return this.service.catalog(); }

  // NOTE: this controller has no class-level PermissionsGuard, so `catalog` and
  // any other route here are reachable by any authenticated user. That is a known
  // defect, tracked separately — new routes must not inherit it.
  @Get(':key')
  @UseGuards(PermissionsGuard)
  @RequirePermission('finance', 1)
  run(@Param('key') key: string, @Query() q: any) { return this.service.run(key, q); }
}

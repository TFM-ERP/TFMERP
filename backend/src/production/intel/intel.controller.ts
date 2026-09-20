import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IntelService } from './intel.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

/** Production Intel — AI situation-room feed for the Overview widget. */
@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/intel')
export class IntelController {
  constructor(private service: IntelService) {}

  @Get(':projectId')
  @ApiOperation({ summary: 'AI risk radar for a project: weather + holidays + local news, ranked into role-targeted alerts (cached 30 min; ?refresh=1 forces a fresh run)' })
  get(@Param('projectId') projectId: string, @Query('refresh') refresh?: string) {
    return this.service.getIntel(projectId, refresh === '1' || refresh === 'true');
  }
}

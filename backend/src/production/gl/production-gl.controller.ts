import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProductionGlService } from './production-gl.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 2)
@Controller('production/gl')
export class ProductionGlController {
  constructor(private service: ProductionGlService) {}
  @Post('sync/:projectId') sync(@Param('projectId') projectId: string) { return this.service.syncProject(projectId); }
  @Get('reconcile/:projectId') reconcile(@Param('projectId') projectId: string) { return this.service.reconcile(projectId); }
}

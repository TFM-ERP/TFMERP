import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuditVaultService } from './audit-vault.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';

// Admin-only vault. Gated at the highest production permission level; every read is logged.
@ApiTags('Comms · Audit vault (admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 3)
@Controller('comms/audit')
export class AuditVaultController {
  constructor(private service: AuditVaultService) {}

  @Get('deleted') deleted(@Query('projectId') projectId?: string) { return this.service.deleted(projectId); }
  @Get('message/:id') view(@Param('id') id: string, @Req() r: any) { return this.service.view(id, r.user?.id); }
  @Get('log') log(@Query('targetId') targetId?: string) { return this.service.accessLog(targetId); }
}

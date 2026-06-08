import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CreditsService } from './credits.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/credits')
export class CreditsController {
  constructor(private service: CreditsService) {}

  @Get(':projectId')
  get(@Param('projectId') projectId: string) { return this.service.getOrBuild(projectId); }

  @Put(':projectId')
  save(@Param('projectId') projectId: string, @Body() body: any) { return this.service.save(projectId, body); }

  @Post(':projectId/regenerate')
  regenerate(@Param('projectId') projectId: string) { return this.service.regenerate(projectId); }
}

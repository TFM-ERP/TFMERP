import { Controller, Get, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RequirePermission } from './require-permission.decorator';

@ApiTags('Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private service: PermissionsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Effective module permissions for the current user' })
  async me(@Request() req) {
    const role = req.user?.role;
    return { role, permissions: await this.service.forRole(role) };
  }

  @Get('matrix')
  @UseGuards(PermissionsGuard)
  @RequirePermission('setup', 3)
  @ApiOperation({ summary: 'Full role × module permission matrix (admin)' })
  matrix() { return this.service.matrix(); }

  @Put('matrix/:role')
  @UseGuards(PermissionsGuard)
  @RequirePermission('setup', 3)
  @ApiOperation({ summary: 'Update a role\'s module permissions (admin)' })
  setForRole(@Param('role') role: string, @Body('permissions') permissions: Record<string, number>) {
    return this.service.setForRole(role, permissions);
  }
}

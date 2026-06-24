import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private service: UsersService) {}

  @Get()
  findAll(@Query() query: any) { return this.service.findAll(query); }

  @Get('available-employees')
  @ApiOperation({ summary: 'Employees without a user account (candidates for new users)' })
  availableEmployees(@Query('search') search?: string) {
    return this.service.availableEmployees(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  // Account management is admin-only — creating users, editing roles, and resetting
  // passwords are privilege-escalation / account-takeover vectors.
  @Post()
  @RequirePermission('setup', 3)
  @ApiOperation({ summary: 'Create a user account linked to an existing employee' })
  create(@Body() body: any) { return this.service.create(body); }

  // Password reset is handled by update() (PUT :id accepts `password`), which the Edit User
  // modal uses — the dedicated reset-password endpoint was a redundant duplicate, removed.
  @Put(':id')
  @RequirePermission('setup', 3)
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }
}

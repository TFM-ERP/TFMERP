import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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

  @Post()
  @ApiOperation({ summary: 'Create a user account linked to an existing employee' })
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string, @Body('password') password: string) {
    return this.service.resetPassword(id, password);
  }
}

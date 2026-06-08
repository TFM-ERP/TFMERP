import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CallSheetsService } from './callsheets.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/callsheets')
export class CallSheetsController {
  constructor(private service: CallSheetsService) {}

  @Get()
  @ApiOperation({ summary: 'List call sheets for a project' })
  list(@Query('projectId') projectId: string) {
    return this.service.list(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a call sheet (auto-seeds contacts & crew from project crew)' })
  create(@Body() body: any, @Req() req: any) {
    return this.service.create(body, req.user?.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Patch(':id/publish')
  publish(@Param('id') id: string) {
    return this.service.publish(id);
  }

  @Post(':id/pull-schedule')
  pullFromSchedule(@Param('id') id: string) {
    return this.service.pullFromSchedule(id);
  }

  @Post(':id/autofill-daylight')
  autofillDaylight(@Param('id') id: string, @Body() body: any) {
    return this.service.autofillDaylight(id, body?.tz ? Number(body.tz) : 240);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

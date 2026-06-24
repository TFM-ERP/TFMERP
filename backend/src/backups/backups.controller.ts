import { Controller, Get, Post, Delete, Body, Param, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { BackupsService } from './backups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';

@ApiTags('Backups')
@ApiBearerAuth()
// DB backup/download/restore/delete is admin-only (matches the permissions matrix).
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('setup', 3)
@Controller('backups')
export class BackupsController {
  constructor(private service: BackupsService) {}

  @Get('status')
  @ApiOperation({ summary: 'Backup tooling status (pg_dump availability, folder, last backup)' })
  status() { return this.service.status(); }

  @Get()
  @ApiOperation({ summary: 'List all backups' })
  list() { return this.service.list(); }

  @Post()
  @ApiOperation({ summary: 'Create a new manual backup' })
  create(@Body('label') label?: string) { return this.service.create(label || '', 'manual'); }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download a backup file' })
  download(@Param('id') id: string, @Res() res: Response) {
    const file = this.service.filePath(id);
    res.download(file, id + '.dump');
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore (load) a backup — auto-snapshots current data first' })
  restore(@Param('id') id: string) { return this.service.restore(id); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a backup' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}

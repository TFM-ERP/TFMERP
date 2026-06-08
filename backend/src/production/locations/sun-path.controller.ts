import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SunPathService } from './sun-path.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/sun-path')
export class SunPathController {
  constructor(private service: SunPathService) {}

  // Raw compute for any coordinate
  @Get() compute(@Query('lat') lat: string, @Query('lng') lng: string, @Query('date') date: string, @Query('tz') tz?: string) {
    return this.service.compute(Number(lat), Number(lng), date, tz ? Number(tz) : 240);
  }
  // Sun position (az/elev) at a clock time
  @Get('position') position(@Query('lat') lat: string, @Query('lng') lng: string, @Query('date') date: string, @Query('time') time: string, @Query('tz') tz?: string) {
    return this.service.position(Number(lat), Number(lng), date, time, tz ? Number(tz) : 240);
  }
  // Resolve a project Location's coords and compute
  @Get('location/:id') forLocation(@Param('id') id: string, @Query('date') date: string, @Query('tz') tz?: string) {
    return this.service.forLocation(id, date, tz ? Number(tz) : 240);
  }
  // Schedule gating: availability + permit + sun window
  @Get('gating/:locationId') gating(@Param('locationId') locationId: string, @Query('date') date: string, @Query('tz') tz?: string) {
    return this.service.gating(locationId, date, tz ? Number(tz) : 240);
  }
}

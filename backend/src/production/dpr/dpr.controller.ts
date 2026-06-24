import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DprService } from './dpr.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/dpr')
export class DprController {
  constructor(private s: DprService) {}
  @Get() list(@Query('projectId') p: string) { return this.s.list(p); }
  @Get('hot-costs/:projectId') hotCosts(@Param('projectId') p: string) { return this.s.hotCosts(p); }
  @Get(':id') get(@Param('id') id: string) { return this.s.get(id); }
  @Post() create(@Body() b: any, @Request() r: any) { return this.s.create(b, r.user?.id); }
  @Post('generate/:callSheetId') generate(@Param('callSheetId') cs: string, @Request() r: any) { return this.s.generateFromCallSheet(cs, r.user?.id); }
  @Put(':id') update(@Param('id') id: string, @Body() b: any) { return this.s.update(id, b); }
  @Patch(':id/status') status(@Param('id') id: string, @Body() b: any) { return this.s.setStatus(id, b.status); }
  @Delete(':id') remove(@Param('id') id: string) { return this.s.remove(id); }
}

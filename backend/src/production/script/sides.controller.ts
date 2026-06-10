import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SidesService } from './sides.service';
import { MailService } from '../mail/mail.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/sides')
export class SidesController {
  constructor(private service: SidesService, private mail: MailService) {}

  @Get('project/:projectId') list(@Param('projectId') projectId: string) { return this.service.list(projectId); }
  @Post('generate/:revisionId') @RequirePermission('production', 2)
  generate(@Param('revisionId') revisionId: string, @Body() b: any, @Req() req: any) { return this.service.generate(revisionId, b, req.user?.id); }
  @Post('facing/:revisionId') @RequirePermission('production', 1)
  facing(@Param('revisionId') revisionId: string, @Body() b: any) { return this.service.facingPages(revisionId, b); }
  @Post(':id/email') @RequirePermission('production', 2) email(@Param('id') id: string) { return this.mail.sendSides(id); }
  @Delete(':id') @RequirePermission('production', 2) remove(@Param('id') id: string) { return this.service.remove(id); }
}

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CrewService } from './crew.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Crew')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('crew')
export class CrewController {
  constructor(private service: CrewService) {}

  @Get() list(@Query() q: any) { return this.service.list(q); }
  @Get('departments') departments() { return this.service.departments(); }
  // V1.2: parent-system users available to map onto a crew record
  @Get('parent-users') parentUsers(@Query('search') search?: string) { return this.service.availableParentUsers(search); }
  @Get(':id/availability') availability(@Param('id') id: string) { return this.service.availability(id); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post('parse-profile') parseProfile(@Body() b: { text: string }) { return this.service.parseProfile(b?.text); }
  @Post() create(@Body() b: any) { return this.service.create(b); }
  @Put(':id') update(@Param('id') id: string, @Body() b: any) { return this.service.update(id, b); }
  // Link/unlink the ERP identity (null = portal-only, zero ledger access)
  @Put(':id/parent-user') linkParent(@Param('id') id: string, @Body() b: { parentSystemUserId: string | null }) { return this.service.linkParentUser(id, b?.parentSystemUserId ?? null); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

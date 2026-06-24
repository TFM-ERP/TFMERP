import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SavedViewsService } from './saved-views.service';

@ApiTags('Saved views')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/saved-views')
export class SavedViewsController {
  constructor(private readonly svc: SavedViewsService) {}

  @Get() list(@Request() req, @Query('module') module?: string) { return this.svc.list(req.user.id, module); }
  @Post() create(@Request() req, @Body() body: any) { return this.svc.create(req.user.id, body); }
  @Put(':id') update(@Request() req, @Param('id') id: string, @Body() body: any) { return this.svc.update(req.user.id, id, body); }
  @Delete(':id') remove(@Request() req, @Param('id') id: string) { return this.svc.remove(req.user.id, id); }
}

import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Comms · Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('comms/channels/:channelId/messages')
export class MessagesController {
  constructor(private service: MessagesService) {}

  @Get() list(@Param('channelId') channelId: string, @Query() q: any) { return this.service.list(channelId, q); }
  @Post() send(@Param('channelId') channelId: string, @Body() b: any, @Req() r: any) { return this.service.send(channelId, b, r.user?.id); }
  @Patch(':id') edit(@Param('id') id: string, @Body() b: any, @Req() r: any) { return this.service.edit(id, b.body, r.user?.id); }
  @Delete(':id') remove(@Param('id') id: string, @Req() r: any) { return this.service.remove(id, r.user?.id); }
}

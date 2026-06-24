import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/** SYS-09 — Comms search: messages across every channel the caller belongs to. */
@ApiTags('Comms · Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('comms/search')
export class CommsSearchController {
  constructor(private messages: MessagesService) {}

  @Get() search(@Req() r: any, @Query() q: any) { return this.messages.search(r.user?.id, q); }
}

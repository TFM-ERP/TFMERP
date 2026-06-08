import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DriverAppService } from './driver-app.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Driver App')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('driver-app')
export class DriverAppController {
  constructor(private service: DriverAppService) {}

  @Get('me')
  me(@Request() req) { return this.service.me(req.user.id); }

  @Get('jobs')
  jobs(@Request() req) { return this.service.myJobs(req.user.id); }

  @Post('submissions')
  createSubmission(@Request() req, @Body() body: any) { return this.service.createSubmission(req.user.id, body); }

  @Get('submissions')
  mySubmissions(@Request() req) { return this.service.mySubmissions(req.user.id); }

  @Get('submissions/pending')
  pending() { return this.service.pending(); }

  @Patch('submissions/:id/review')
  review(@Param('id') id: string, @Body() body: { status: 'APPROVED' | 'REJECTED'; notes?: string }, @Request() req) {
    return this.service.review(id, body.status, req.user.id, body.notes);
  }
}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';

/** SYS-08 — Meetings & notes: scheduling, agenda, minutes, action items. */
@Module({
  imports: [PrismaModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}

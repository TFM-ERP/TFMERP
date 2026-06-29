import { Module } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoEnginesService } from './video-engines.service';
import { VideoEnginesController } from './video-engines.controller';

/**
 * VERTICAL_AI_VIDEO render orchestration + the Video engines governance switchboard.
 * PrismaModule is @Global, so PrismaService is injectable here without importing it.
 */
@Module({
  providers: [VideoService, VideoEnginesService],
  controllers: [VideoEnginesController],
  exports: [VideoService, VideoEnginesService],
})
export class VideoModule {}

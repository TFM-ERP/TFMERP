import { Module } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { EmailService } from './email.service';
import { CollectionsController } from './collections.controller';

@Module({
  controllers: [CollectionsController],
  providers: [CollectionsService, EmailService],
  exports: [EmailService],
})
export class CollectionsModule {}

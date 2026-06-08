import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { EmailService } from '../collections/email.service';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, EmailService],
  exports: [SettingsService],
})
export class SettingsModule {}

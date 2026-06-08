import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PermissionsModule } from '../permissions/permissions.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { PmModule } from '../pm/pm.module';
import { EmailService } from '../collections/email.service';

@Module({
  imports: [PermissionsModule, ComplianceModule, PmModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService],
})
export class NotificationsModule {}

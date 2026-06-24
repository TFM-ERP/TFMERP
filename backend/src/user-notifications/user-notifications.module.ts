import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { UserNotificationsService } from './user-notifications.service';
import { UserNotificationsController } from './user-notifications.controller';

@Module({
  imports: [PrismaModule],
  controllers: [UserNotificationsController],
  providers: [UserNotificationsService],
  exports: [UserNotificationsService],
})
export class UserNotificationsModule {}

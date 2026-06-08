import { Module } from '@nestjs/common';
import { DriverAppService } from './driver-app.service';
import { DriverAppController } from './driver-app.controller';

@Module({ controllers: [DriverAppController], providers: [DriverAppService] })
export class DriverAppModule {}

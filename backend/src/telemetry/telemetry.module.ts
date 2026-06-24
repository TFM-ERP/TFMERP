import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CommsModule } from '../comms/comms.module';
import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';
import { TelemetryGateway } from './telemetry.gateway';

/** SYS-06 — Transport GPS telemetry: driver shifts, ping ingest, live dispatch map + realtime push, geofences. */
@Module({
  imports: [PrismaModule, CommsModule, JwtModule.register({ secret: process.env.JWT_SECRET })],
  controllers: [TelemetryController],
  providers: [TelemetryService, TelemetryGateway],
  exports: [TelemetryService],
})
export class TelemetryModule {}

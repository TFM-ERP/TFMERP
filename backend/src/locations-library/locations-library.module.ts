import { Module } from '@nestjs/common';
import { LocationsLibraryController } from './locations-library.controller';
import { LocationsLibraryService } from './locations-library.service';
import { ScoutingController } from './scouting.controller';
import { ScoutingService } from './scouting.service';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { LocationOpsService } from './location-ops.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LocationsLibraryController, ScoutingController, AssessmentController],
  providers: [LocationsLibraryService, ScoutingService, AssessmentService, LocationOpsService],
  exports: [LocationsLibraryService, ScoutingService, AssessmentService, LocationOpsService],
})
export class LocationsLibraryModule {}

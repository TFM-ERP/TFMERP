import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { SavedViewsService } from './saved-views.service';
import { SavedViewsController } from './saved-views.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SavedViewsController],
  providers: [SavedViewsService],
  exports: [SavedViewsService],
})
export class SavedViewsModule {}

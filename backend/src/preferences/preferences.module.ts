import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { PreferencesService } from './preferences.service';
import { PreferencesController } from './preferences.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PreferencesController],
  providers: [PreferencesService],
})
export class PreferencesModule {}

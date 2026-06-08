import { Module } from '@nestjs/common';
import { DamageService } from './damage.service';
import { DamageController } from './damage.controller';

@Module({
  providers: [DamageService],
  controllers: [DamageController],
  exports: [DamageService],
})
export class DamageModule {}

import { Module } from '@nestjs/common';
import { FuelService } from './fuel.service';
import { FuelController } from './fuel.controller';

@Module({
  providers: [FuelService],
  controllers: [FuelController],
  exports: [FuelService],
})
export class FuelModule {}

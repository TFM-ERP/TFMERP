import { Module, Global } from '@nestjs/common';
import { StatusService } from './status.service';
import { StatusController } from './status.controller';

@Global()   // makes StatusService injectable everywhere without re-importing
@Module({
  controllers: [StatusController],
  providers:   [StatusService],
  exports:     [StatusService],
})
export class StatusModule {}

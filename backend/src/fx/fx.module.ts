import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { FxController } from './fx.controller';
import { FxService } from './fx.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [FxController],
  providers: [FxService],
  exports: [FxService],
})
export class FxModule {}

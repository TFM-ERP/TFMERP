import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { CompanyLogoController } from './company-logo.controller';

@Module({
  providers: [CompanyService],
  // CompanyLogoController is separate from CompanyController on purpose: the
  // latter carries a class-level JwtAuthGuard, and the logo route must be
  // reachable by an <img> tag, which sends no Authorization header.
  controllers: [CompanyController, CompanyLogoController],
  exports: [CompanyService],
})
export class CompanyModule {}

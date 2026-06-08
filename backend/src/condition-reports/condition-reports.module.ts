import { Module } from '@nestjs/common';
import { ConditionReportsService } from './condition-reports.service';
import { ConditionReportsController } from './condition-reports.controller';

@Module({ controllers: [ConditionReportsController], providers: [ConditionReportsService] })
export class ConditionReportsModule {}

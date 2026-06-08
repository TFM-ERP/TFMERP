import { Module } from '@nestjs/common';
import { HrService } from './hr.service';
import { HrController } from './hr.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';

@Module({
  providers: [HrService, AttendanceService, PayrollService],
  controllers: [HrController, AttendanceController, PayrollController],
  exports: [HrService, AttendanceService, PayrollService],
})
export class HrModule {}

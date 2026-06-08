import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('HR — Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/attendance')
export class AttendanceController {
  constructor(private service: AttendanceService) {}

  @Get()
  list(@Query() query: any) {
    return this.service.list(query);
  }

  @Get('timesheet')
  timesheet(@Query('month') month: string, @Query('year') year: string) {
    const now = new Date();
    return this.service.timesheet(
      month ? Number(month) : now.getMonth() + 1,
      year ? Number(year) : now.getFullYear(),
    );
  }

  @Post('clock-in')
  clockIn(@Body() body: { employeeId: string; at?: string }) {
    return this.service.clockIn(body.employeeId, body.at);
  }

  @Patch(':id/clock-out')
  clockOut(@Param('id') id: string, @Body() body: { at?: string }) {
    return this.service.clockOut(id, body?.at);
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

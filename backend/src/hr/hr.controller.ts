import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HrService } from './hr.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('HR & Workforce')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr')
export class HrController {
  constructor(private service: HrService) {}

  // Reports (declare before :id routes)
  @Get('employees/stats')
  stats() {
    return this.service.stats();
  }

  @Get('expiry-alerts')
  @ApiOperation({ summary: 'Upcoming document/visa/contract expiries' })
  expiryAlerts(@Query('days') days?: string) {
    return this.service.expiryAlerts(days ? Number(days) : 60);
  }

  // Employees
  @Get('employees')
  @ApiOperation({ summary: 'List employees (filterable)' })
  findAll(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Get('employees/:id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('employees')
  @ApiOperation({ summary: 'Create an employee (with optional documents/certs/driver)' })
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Put('employees/:id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete('employees/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // Documents
  @Post('employees/:id/documents')
  addDocument(@Param('id') id: string, @Body() body: any) {
    return this.service.addDocument(id, body);
  }
  @Delete('documents/:docId')
  removeDocument(@Param('docId') docId: string) {
    return this.service.removeDocument(docId);
  }

  // Leave
  @Get('leave')
  listLeave(@Query() query: any) {
    return this.service.listLeave(query);
  }
  @Post('leave')
  createLeave(@Body() body: any) {
    return this.service.createLeave(body);
  }
  @Patch('leave/:id/status')
  setLeaveStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.service.setLeaveStatus(id, body.status);
  }

  // Assets
  @Post('employees/:id/assets')
  assignAsset(@Param('id') id: string, @Body() body: any) {
    return this.service.assignAsset(id, body);
  }
  @Patch('assets/:id/return')
  returnAsset(@Param('id') id: string) {
    return this.service.returnAsset(id);
  }

  // Certifications
  @Post('employees/:id/certifications')
  addCertification(@Param('id') id: string, @Body() body: any) {
    return this.service.addCertification(id, body);
  }
  @Delete('certifications/:id')
  removeCertification(@Param('id') id: string) {
    return this.service.removeCertification(id);
  }
}

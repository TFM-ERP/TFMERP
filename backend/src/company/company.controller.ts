import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Company Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('company')
export class CompanyController {
  constructor(private service: CompanyService) {}

  // Profile
  @Get()
  @ApiOperation({ summary: 'Get the master company profile' })
  getProfile() {
    return this.service.getProfile();
  }

  @Put()
  @ApiOperation({ summary: 'Update the company profile' })
  updateProfile(@Body() body: any) {
    return this.service.updateProfile(body);
  }

  @Post('complete-setup')
  @ApiOperation({ summary: 'Mark the initial company setup wizard complete' })
  completeSetup(@Body() body: any) {
    return this.service.completeSetup(body);
  }

  @Get('expiry-alerts')
  @ApiOperation({ summary: 'License / tax / document expiry alerts' })
  expiryAlerts(@Query('days') days?: string) {
    return this.service.expiryAlerts(days ? Number(days) : 60);
  }

  // Bank accounts
  @Get('bank-accounts')
  listBankAccounts() {
    return this.service.listBankAccounts();
  }

  @Post('bank-accounts')
  createBankAccount(@Body() body: any) {
    return this.service.createBankAccount(body);
  }

  @Put('bank-accounts/:id')
  updateBankAccount(@Param('id') id: string, @Body() body: any) {
    return this.service.updateBankAccount(id, body);
  }

  @Delete('bank-accounts/:id')
  deleteBankAccount(@Param('id') id: string) {
    return this.service.deleteBankAccount(id);
  }

  // Locations
  @Get('locations')
  listLocations() {
    return this.service.listLocations();
  }

  @Post('locations')
  createLocation(@Body() body: any) {
    return this.service.createLocation(body);
  }

  @Put('locations/:id')
  updateLocation(@Param('id') id: string, @Body() body: any) {
    return this.service.updateLocation(id, body);
  }

  @Delete('locations/:id')
  deleteLocation(@Param('id') id: string) {
    return this.service.deleteLocation(id);
  }

  // Documents
  @Get('documents')
  listDocuments() {
    return this.service.listDocuments();
  }

  @Post('documents')
  createDocument(@Body() body: any) {
    return this.service.createDocument(body);
  }

  @Put('documents/:id')
  updateDocument(@Param('id') id: string, @Body() body: any) {
    return this.service.updateDocument(id, body);
  }

  @Delete('documents/:id')
  deleteDocument(@Param('id') id: string) {
    return this.service.deleteDocument(id);
  }
}

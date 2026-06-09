import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { FinanceModule } from './finance/finance.module';
import { RentalModule } from './rental/rental.module';
import { ProductionModule } from './production/production.module';
import { UploadModule } from './upload/upload.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { ContactsModule } from './contacts/contacts.module';
import { SettingsModule } from './settings/settings.module';
import { StatusModule } from './status/status.module';
import { CompanyModule } from './company/company.module';
import { HrModule } from './hr/hr.module';
import { BackupsModule } from './backups/backups.module';
import { ComplianceModule } from './compliance/compliance.module';
import { PmModule } from './pm/pm.module';
import { ConditionReportsModule } from './condition-reports/condition-reports.module';
import { PermissionsModule } from './permissions/permissions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DriverAppModule } from './driver-app/driver-app.module';
import { CollectionsModule } from './collections/collections.module';
import { ReportsModule } from './reports/reports.module';
import { CrmModule } from './crm/crm.module';
import { CrewModule } from './crew/crew.module';
import { InventoryModule } from './inventory/inventory.module';
import { AccountingModule } from './accounting/accounting.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuditModule } from './audit/audit.module';
import { FxModule } from './fx/fx.module';
import { LaborModule } from './labor/labor.module';
import { WorkflowModule } from './workflow/workflow.module';
import { LocationsLibraryModule } from './locations-library/locations-library.module';
import { OtpModule } from './security/otp.module';
import { AccountModule } from './account/account.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StatusModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    FinanceModule,
    RentalModule,
    ProductionModule,
    UploadModule,
    MaintenanceModule,
    ContactsModule,
    SettingsModule,
    CompanyModule,
    HrModule,
    BackupsModule,
    ComplianceModule,
    PmModule,
    ConditionReportsModule,
    PermissionsModule,
    NotificationsModule,
    DriverAppModule,
    CollectionsModule,
    ReportsModule,
    CrmModule,
    CrewModule,
    InventoryModule,
    AccountingModule,
    ApprovalsModule,
    IntegrationsModule,
    DashboardModule,
    AuditModule,
    FxModule,
    LaborModule,
    WorkflowModule,
    LocationsLibraryModule,
    OtpModule,
    AccountModule,
  ],
})
export class AppModule {}

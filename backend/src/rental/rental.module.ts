import { Module } from '@nestjs/common';
import { AssetsModule } from './assets/assets.module';
import { BookingsModule } from './bookings/bookings.module';
import { ContractsModule } from './contracts/contracts.module';
import { DriversModule } from './drivers/drivers.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { FuelModule } from './fuel/fuel.module';
import { DamageModule } from './damage/damage.module';
import { IncidentsModule } from './incidents/incidents.module';
import { LogisticsModule } from './logistics/logistics.module';

@Module({
  imports: [
    AssetsModule,
    BookingsModule,
    ContractsModule,
    DriversModule,
    MaintenanceModule,
    FuelModule,
    DamageModule,
    IncidentsModule,
    LogisticsModule,
  ],
  exports: [AssetsModule, BookingsModule, ContractsModule, DriversModule, IncidentsModule],
})
export class RentalModule {}

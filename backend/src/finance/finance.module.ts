import { Module } from '@nestjs/common';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { QuotationsModule } from './quotations/quotations.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { VatModule } from './vat/vat.module';
import { FinanceReportsModule } from './reports/finance-reports.module';
import { ExpensesModule } from './expenses/expenses.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ServicesModule } from './services/services.module';

@Module({
  imports: [
    BankAccountsModule,
    QuotationsModule,
    InvoicesModule,
    PaymentsModule,
    VatModule,
    FinanceReportsModule,
    ExpensesModule,
    SuppliersModule,
    ServicesModule,
  ],
  exports: [
    BankAccountsModule,
    QuotationsModule,
    InvoicesModule,
    PaymentsModule,
    ExpensesModule,
  ],
})
export class FinanceModule {}

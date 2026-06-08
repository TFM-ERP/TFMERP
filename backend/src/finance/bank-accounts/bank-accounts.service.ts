import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

@Injectable()
export class BankAccountsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.bankAccount.findMany({
      orderBy: [{ isDefaultInvoice: 'desc' }, { bankName: 'asc' }],
    });
  }

  async findOne(id: string) {
    const account = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException(`Bank account ${id} not found`);
    return account;
  }

  async create(dto: CreateBankAccountDto) {
    // If setting as default, unset others first
    if (dto.isDefaultInvoice) {
      await this.prisma.bankAccount.updateMany({ data: { isDefaultInvoice: false } });
    }
    if (dto.isDefaultQuotation) {
      await this.prisma.bankAccount.updateMany({ data: { isDefaultQuotation: false } });
    }
    if (dto.isDefaultReceiving) {
      await this.prisma.bankAccount.updateMany({ data: { isDefaultReceiving: false } });
    }
    return this.prisma.bankAccount.create({ data: dto });
  }

  async update(id: string, dto: UpdateBankAccountDto) {
    await this.findOne(id);
    if (dto.isDefaultInvoice) {
      await this.prisma.bankAccount.updateMany({ where: { id: { not: id } }, data: { isDefaultInvoice: false } });
    }
    if (dto.isDefaultQuotation) {
      await this.prisma.bankAccount.updateMany({ where: { id: { not: id } }, data: { isDefaultQuotation: false } });
    }
    if (dto.isDefaultReceiving) {
      await this.prisma.bankAccount.updateMany({ where: { id: { not: id } }, data: { isDefaultReceiving: false } });
    }
    return this.prisma.bankAccount.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft delete — just deactivate
    return this.prisma.bankAccount.update({ where: { id }, data: { isActive: false } });
  }

  async getDefault() {
    return {
      invoice: await this.prisma.bankAccount.findFirst({ where: { isDefaultInvoice: true, isActive: true } }),
      quotation: await this.prisma.bankAccount.findFirst({ where: { isDefaultQuotation: true, isActive: true } }),
      receiving: await this.prisma.bankAccount.findFirst({ where: { isDefaultReceiving: true, isActive: true } }),
    };
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  // ── Items ────────────────────────────────────────────────────────────────────

  async list(query: { search?: string; category?: string; lowStock?: string; active?: string }) {
    const where: any = {};
    if (query.active !== 'all') where.isActive = true;
    if (query.category) where.category = query.category;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { category: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const items = await this.prisma.inventoryItem.findMany({ where, orderBy: { name: 'asc' } });
    const mapped = items.map(i => ({
      ...i,
      value: Number(i.quantity) * Number(i.unitCost),
      low: Number(i.quantity) <= Number(i.reorderLevel),
    }));
    if (query.lowStock === 'true') return mapped.filter(i => i.low);
    return mapped;
  }

  async findOne(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: { movements: { orderBy: { movementDate: 'desc' }, take: 100 } },
    });
    if (!item) throw new NotFoundException(`Inventory item ${id} not found`);
    return {
      ...item,
      value: Number(item.quantity) * Number(item.unitCost),
      low: Number(item.quantity) <= Number(item.reorderLevel),
    };
  }

  async categories(): Promise<string[]> {
    const rows = await this.prisma.inventoryItem.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return rows.map(r => r.category!).filter(Boolean);
  }

  async create(data: {
    name: string; sku?: string; category?: string; unit?: string;
    unitCost?: number; quantity?: number; reorderLevel?: number;
    location?: string; supplierId?: string; supplierName?: string; notes?: string;
  }, userId?: string) {
    if (!data.name) throw new BadRequestException('Name is required');
    const qty = Number(data.quantity ?? 0);
    const item = await this.prisma.inventoryItem.create({
      data: {
        name: data.name,
        sku: data.sku || null,
        category: data.category || null,
        unit: data.unit || 'each',
        unitCost: data.unitCost ?? 0,
        quantity: qty,
        reorderLevel: data.reorderLevel ?? 0,
        location: data.location || null,
        supplierId: data.supplierId || null,
        supplierName: data.supplierName || null,
        notes: data.notes || null,
      },
    });
    // Opening balance movement
    if (qty > 0) {
      await this.prisma.stockMovement.create({
        data: {
          itemId: item.id, type: 'IN', quantity: qty, unitCost: data.unitCost ?? 0,
          reason: 'Opening balance', balanceAfter: qty, createdById: userId || null,
        },
      });
    }
    return item;
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    const { id: _id, movements, value, low, quantity, createdAt, updatedAt, ...rest } = data || {};
    // Note: quantity is NOT editable here — it changes only via movements.
    return this.prisma.inventoryItem.update({ where: { id }, data: rest });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.inventoryItem.delete({ where: { id } });
  }

  // ── Movements ────────────────────────────────────────────────────────────────

  async recordMovement(itemId: string, data: {
    type: 'IN' | 'OUT' | 'ADJUST'; quantity: number; unitCost?: number;
    reference?: string; reason?: string; notes?: string; movementDate?: string;
  }, userId?: string) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Inventory item ${itemId} not found`);

    const qty = Math.abs(Number(data.quantity));
    if (!qty && data.type !== 'ADJUST') throw new BadRequestException('Quantity must be greater than zero');

    const current = Number(item.quantity);
    let balanceAfter: number;
    if (data.type === 'IN') balanceAfter = current + qty;
    else if (data.type === 'OUT') {
      balanceAfter = current - qty;
      if (balanceAfter < 0) throw new BadRequestException(`Not enough stock. On hand: ${current}`);
    } else {
      // ADJUST → quantity is the new absolute count
      balanceAfter = Number(data.quantity);
      if (balanceAfter < 0) throw new BadRequestException('Adjusted quantity cannot be negative');
    }

    const [movement] = await this.prisma.$transaction([
      this.prisma.stockMovement.create({
        data: {
          itemId,
          type: data.type,
          quantity: data.type === 'ADJUST' ? Math.abs(balanceAfter - current) : qty,
          unitCost: data.unitCost ?? (data.type === 'IN' ? Number(item.unitCost) : null),
          reference: data.reference || null,
          reason: data.reason || null,
          notes: data.notes || null,
          balanceAfter,
          createdById: userId || null,
          movementDate: data.movementDate ? new Date(data.movementDate) : new Date(),
        },
      }),
      this.prisma.inventoryItem.update({
        where: { id: itemId },
        data: {
          quantity: balanceAfter,
          // refresh unit cost on purchases
          ...(data.type === 'IN' && data.unitCost ? { unitCost: data.unitCost } : {}),
        },
      }),
    ]);
    return movement;
  }

  async summary() {
    const items = await this.prisma.inventoryItem.findMany({ where: { isActive: true } });
    let totalValue = 0;
    const lowStock: any[] = [];
    for (const i of items) {
      totalValue += Number(i.quantity) * Number(i.unitCost);
      if (Number(i.quantity) <= Number(i.reorderLevel)) {
        lowStock.push({ id: i.id, name: i.name, sku: i.sku, quantity: Number(i.quantity), reorderLevel: Number(i.reorderLevel), unit: i.unit });
      }
    }
    return {
      totalItems: items.length,
      totalValue,
      lowStockCount: lowStock.length,
      lowStock: lowStock.sort((a, b) => (a.quantity - a.reorderLevel) - (b.quantity - b.reorderLevel)),
    };
  }
}

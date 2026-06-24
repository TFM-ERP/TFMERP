import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { join } from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CostingService } from './costing.service';
import { MessagesService } from '../../comms/messages.service';

/**
 * Chat-to-ledger receipt bot.
 * A dept head drops a receipt photo in their project channel; we OCR it (reusing the
 * costing Anthropic-vision extractor), DRAFT a ProjectTransaction with a suggested
 * 3000/4000 cost code + VAT, and post an ENTITY_CARD approval card live in the thread.
 * A lead taps Approve → the ledger entry flips to APPROVED. No schema change — the card
 * is a normal message carrying JSON, the entry is a normal project transaction.
 */
const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'CAD'];
// receipt spend category → master Chart-of-Accounts code (industry topsheet)
const ACCOUNT_MAP: Record<string, [string, string]> = {
  cater: ['2522', 'Craft Service & Meals'], food: ['2522', 'Craft Service & Meals'], meal: ['2522', 'Craft Service & Meals'], coffee: ['2522', 'Craft Service & Meals'],
  fuel: ['3511', 'Production Vehicle Rentals & Fuel'], petrol: ['3511', 'Production Vehicle Rentals & Fuel'], transport: ['3511', 'Production Vehicle Rentals & Fuel'], taxi: ['3511', 'Production Vehicle Rentals & Fuel'], parking: ['3511', 'Production Vehicle Rentals & Fuel'],
  suppl: ['6803', 'Office Supplies & Courier'], station: ['6803', 'Office Supplies & Courier'], office: ['6803', 'Office Supplies & Courier'], courier: ['6803', 'Office Supplies & Courier'],
  hardware: ['2311', 'Construction Materials'], construct: ['2311', 'Construction Materials'], lumber: ['2311', 'Construction Materials'], paint: ['2311', 'Construction Materials'],
  prop: ['2811', 'Prop Purchases / Rentals'], wardrobe: ['2911', 'Costume Purchases / Rentals'], costume: ['2911', 'Costume Purchases / Rentals'], makeup: ['3111', 'Makeup & Hair Supplies'],
};
function mapAccount(cat?: string | null): [string | null, string] {
  if (!cat) return [null, 'Uncoded — set on approval'];
  const k = String(cat).toLowerCase();
  for (const key in ACCOUNT_MAP) if (k.includes(key)) return ACCOUNT_MAP[key];
  return ['6805', 'Miscellaneous / Petty Cash'];
}

@Injectable()
export class ChatReceiptService {
  constructor(private prisma: PrismaService, private costing: CostingService, private messages: MessagesService) {}

  /** OCR a chat receipt → DRAFT transaction + a live ENTITY_CARD approval card in the channel. */
  async intake(d: { channelId?: string; messageId?: string; projectId: string; imagePath: string; mime?: string }, userId?: string) {
    if (!d?.projectId || !d?.imagePath) throw new BadRequestException('projectId and imagePath are required');
    // Driver glovebox runs may not carry a thread id — fall back to the project's main channel.
    let channelId = d.channelId;
    if (!channelId) {
      const ch = await this.prisma.channel.findFirst({ where: { scopeType: 'PROJECT', scopeId: d.projectId } }).catch(() => null);
      channelId = ch?.id;
    }
    if (!channelId) throw new BadRequestException('No channel found for this receipt');
    const diskPath = join(process.cwd(), String(d.imagePath).replace(/^\/+/, ''));
    const ocr: any = await this.costing.ocrReceipt(diskPath, d.mime || 'image/jpeg').catch(() => ({}));

    const amount = Number(ocr.total) || 0;
    const vat = Number(ocr.taxAmount) || 0;
    const vendor = ocr.merchant || null;
    const category = ocr.category || null;
    const currency = CURRENCIES.includes(String(ocr.currency)) ? ocr.currency : 'AED';
    const [accountCode, accountTitle] = mapAccount(category);
    const date = ocr.date && /^\d{4}-\d{2}-\d{2}$/.test(ocr.date) ? new Date(ocr.date) : new Date();

    const txn = await this.prisma.projectTransaction.create({
      data: {
        projectId: d.projectId, kind: 'COST', status: 'DRAFT', date,
        accountCode, accountTitle, category,
        description: `Receipt (chat) — ${vendor || category || 'expense'}`,
        party: vendor, amount, taxAmount: vat, total: amount, currency: currency as any,
        createdById: userId ?? null,
      },
    });

    const cardBody = JSON.stringify({
      kind: 'receipt', txnId: txn.id, vendor, amount, vat, currency, accountCode, accountTitle,
      status: 'PENDING', confidence: Number(ocr.confidence) || 0,
    });
    const card = await this.messages.send(channelId, {
      type: 'ENTITY_CARD', body: cardBody,
      attachments: [{ kind: 'IMAGE', sharedPath: d.imagePath, originalPath: d.imagePath }],
    }, userId);

    await this.prisma.projectTransaction.update({ where: { id: txn.id }, data: { reference: `chat:${channelId}:${card?.id || ''}` } });
    return { txnId: txn.id, cardMessageId: card?.id, accountCode, accountTitle, amount, vat, vendor, currency, confidence: Number(ocr.confidence) || 0 };
  }

  /** Re-stringify the card message with patched fields so the thread updates live. */
  private async updateCard(txn: any, patch: any) {
    const ref = String(txn.reference || '');
    const cardId = ref.startsWith('chat:') ? ref.split(':')[2] : null;
    if (!cardId) return;
    const msg = await this.prisma.message.findUnique({ where: { id: cardId } });
    if (!msg?.body) return;
    let data: any = {};
    try { data = JSON.parse(msg.body); } catch { data = {}; }
    await this.messages.edit(cardId, JSON.stringify({ ...data, ...patch }), undefined).catch(() => null);
  }

  async approve(txnId: string, userId?: string) {
    const txn = await this.prisma.projectTransaction.findUnique({ where: { id: txnId } });
    if (!txn) throw new NotFoundException();
    const updated = await this.prisma.projectTransaction.update({ where: { id: txnId }, data: { status: 'APPROVED', approvedById: userId ?? null } });
    await this.updateCard(txn, { status: 'APPROVED', approvedBy: userId ?? null });
    return updated;
  }

  async reject(txnId: string, userId?: string) {
    const txn = await this.prisma.projectTransaction.findUnique({ where: { id: txnId } });
    if (!txn) throw new NotFoundException();
    const updated = await this.prisma.projectTransaction.update({ where: { id: txnId }, data: { status: 'VOID' } });
    await this.updateCard(txn, { status: 'REJECTED', rejectedBy: userId ?? null });
    return updated;
  }
}

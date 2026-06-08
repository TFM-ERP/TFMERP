import { Injectable, Logger } from '@nestjs/common';

/**
 * SAP Concur — MOCK expense-push wrapper. Real integration would POST the trip's
 * actuals to Concur's Expense API; here we return a mock report id. Swap in the
 * live client when CONCUR_CLIENT_ID / SECRET are set in backend/.env.
 *
 * NOTE: Concur is the EXTERNAL expense system. Inside TFM, the source of truth
 * for spend is ALWAYS the ProjectTransaction ledger — this push is a mirror, not
 * the posting itself.
 */
@Injectable()
export class ConcurService {
  private readonly log = new Logger('ConcurService');
  private get live() { return !!process.env.CONCUR_CLIENT_ID; }

  async pushExpense(payload: { tripId: string; traveler?: string; lines: { type: string; amount: number; currency: string; description?: string }[] }) {
    const total = (payload.lines || []).reduce((a, l) => a + Number(l.amount || 0), 0);
    const reportId = 'CNQ' + Math.random().toString(36).slice(2, 9).toUpperCase();
    this.log.debug(`[mock] pushExpense trip=${payload.tripId} lines=${payload.lines?.length} total=${total}`);
    return { provider: 'concur', live: this.live, reportId, status: 'SUBMITTED', total, currency: payload.lines?.[0]?.currency || 'AED' };
  }
}

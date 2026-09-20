/**
 * The single mapping from `Expense.category` to a GL expense account.
 *
 * Companion to `revenue-mapping.util.ts`. No Nest or Prisma imports, so it is
 * unit-testable on its own.
 *
 * Two layers, in order:
 *
 *  1. `CATEGORY_ACCOUNTS` — an exact, case-insensitive match on the categories
 *     that actually exist in the data. Explicit beats clever: it is auditable,
 *     and an accountant can read it.
 *  2. `keywordAccount()` — the original substring heuristics, kept only as a
 *     guess for a category nobody has classified yet.
 *
 * Anything still unmatched lands in 6900 Other Expenses.
 *
 * The heuristics are deliberately second, not first. Substring matching on an
 * accounting category is hazardous — `includes('rent')` alone would send a
 * category like "Equipment Rental" to 6100 Rent & Utilities, and `includes('insur')`
 * would catch "Insurance Claim Recovery". Exact matches shield every known
 * category from that.
 *
 * Every target below is one of the 30 accounts in `STANDARD_COA`. No new account
 * is introduced.
 */

/** Exact category to account. Keys are compared lower-cased and trimmed. */
export const CATEGORY_ACCOUNTS: Record<string, string> = {
  // ── Cost of sales ──
  // Sub-contracted production houses, editing, music licensing: the direct cost
  // of delivering the work that was invoiced.
  'production costs': '5000',
  // "BTL" is below-the-line, i.e. crew. Crew hotels and per-diems sit with the
  // crew cost line a reader already associates with them.
  'btl travel & living': '5300',
  'fuel': '5100',
  'maintenance': '5200',

  // ── Operating expenses ──
  // Overwhelmingly the twofour54 Co-Create licence and the Yas Creative Hub
  // hot-desk agreement — premises, not an administrative fee.
  'licence & facilities': '6100',
  'office': '6200',
  // Commercial printing, an administrative overhead rather than a unit cost.
  'printing': '6200',
  // Hypermarket runs and repeated sub-100 AED tabs: office refreshment, not
  // unit catering. Revisit if a production-catering category ever appears.
  'catering': '6200',
  // Google Workspace, Frame.io, Midjourney. No dedicated software account
  // exists in the standard chart, and admin overhead is the closest true home.
  'software & subscriptions': '6200',

  // ── Deliberately left in 6900 ──
  // Genuinely heterogeneous — auction fees, telephone, ad-hoc equipment hire.
  // Splitting it would need per-row reclassification, not a category rule.
  'miscellaneous general exp': '6900',
  // A 20,401 AED laptop is capital expenditure, not an operating expense.
  // It is NOT mapped to 1500 Rental Fleet & Equipment: there is no depreciation
  // method, useful life or accumulated-depreciation mechanism in the schema, so
  // capitalising it would create an asset that could never be written down.
  // Left in 6900 until a fixed-asset register exists.
  'equipment': '6900',
};

/** Legacy substring heuristics — a guess for categories not yet classified. */
export function keywordAccount(category?: string | null): string | null {
  const c = (category || '').toLowerCase();
  if (!c) return null;
  if (c.includes('fuel') || c.includes('transport')) return '5100';
  if (c.includes('mainten') || c.includes('repair')) return '5200';
  if (c.includes('crew') || c.includes('freelan')) return '5300';
  if (c.includes('salar') || c.includes('wage') || c.includes('payroll')) return '6000';
  if (c.includes('rent') || c.includes('utilit')) return '6100';
  if (c.includes('office') || c.includes('admin')) return '6200';
  if (c.includes('market') || c.includes('advert')) return '6300';
  if (c.includes('insur')) return '6400';
  if (c.includes('bank')) return '6500';
  return null;
}

/** Which GL expense account an expense category debits. Unknown falls to 6900. */
export function expenseAccountCode(category?: string | null): string {
  const key = (category || '').trim().toLowerCase();
  return CATEGORY_ACCOUNTS[key] ?? keywordAccount(key) ?? '6900';
}

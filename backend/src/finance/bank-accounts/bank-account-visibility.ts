import { NotFoundException } from '@nestjs/common';

/**
 * Who may be shown which bank account.
 *
 *   a COMPANY account — the one printed on invoices          → finance 1 (view) and up
 *   an OWNER account  — the GM's own, kept to record what he
 *                       paid personally                      → finance 2 (edit) and up
 *
 * APPLIED AT THE CONTROLLER BOUNDARY, NOT IN THE SERVICES. CompanyService.getProfile() is also
 * called from inside updateProfile() and completeSetup(); BankAccountsService.findOne() from
 * inside update() and remove(). A service that filtered by role would hand those internal callers
 * a silently shortened list. The services return everything; each handler that answers a browser
 * passes the result through here on the way out.
 *
 * It composes with @RequirePermission rather than replacing it: the guard decides whether the
 * caller reaches the handler at all, this decides which rows come back. On GET /company, which
 * has no requirement because SetupGate reads it on every page, this is the only rule there is.
 */

/** The level a COMPANY row needs. */
export const COMPANY_ACCOUNT_LEVEL = 1;
/** The level any other row needs. */
export const OWNER_ACCOUNT_LEVEL = 2;

type Row = { ownership?: unknown } | null | undefined;
type User = { role?: string } | null | undefined;
type Levels = { forRole(role: string): Promise<Record<string, number>> };

/** Only a row that says COMPANY is a company row. Anything else is held to the owner level. */
export function mayReadBankAccount(financeLevel: number, row: Row): boolean {
  if (!row) return false;
  const needed = row.ownership === 'COMPANY' ? COMPANY_ACCOUNT_LEVEL : OWNER_ACCOUNT_LEVEL;
  return Number.isFinite(financeLevel) && financeLevel >= needed;
}

export function filterBankAccounts<T extends Row>(financeLevel: number, rows: T[] | null | undefined): T[] {
  return (rows ?? []).filter((r) => mayReadBankAccount(financeLevel, r));
}

/** The caller's live finance level — from role_permissions, not from the request. 0 when there is no role. */
export async function financeLevelOf(permissions: Levels, user: User): Promise<number> {
  if (!user?.role) return 0;
  const level = (await permissions.forRole(user.role))?.finance;
  return typeof level === 'number' && Number.isFinite(level) ? level : 0;
}

/** A list, with the rows this caller may not see removed. */
export async function visibleBankAccounts<T extends Row>(permissions: Levels, user: User, rows: T[] | null | undefined): Promise<T[]> {
  return filterBankAccounts(await financeLevelOf(permissions, user), rows);
}

/**
 * One account fetched by id. A row the caller may not see is answered exactly as a row that does
 * not exist — a 403 here would confirm that the id belongs to somebody's personal account.
 */
export async function visibleBankAccount<T extends Row>(permissions: Levels, user: User, row: T, id: string): Promise<T> {
  if (!mayReadBankAccount(await financeLevelOf(permissions, user), row)) throw new NotFoundException(`Bank account ${id} not found`);
  return row;
}

/** One account that may be absent (a default slot): null when absent or not visible. */
export async function visibleBankAccountOrNull<T extends Row>(permissions: Levels, user: User, row: T): Promise<T | null> {
  return row && mayReadBankAccount(await financeLevelOf(permissions, user), row) ? row : null;
}

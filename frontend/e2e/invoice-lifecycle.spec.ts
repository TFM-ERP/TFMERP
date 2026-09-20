import { test, expect, type Page } from 'playwright/test';

/**
 * Read-only Playwright coverage for the invoice lifecycle UI.
 *
 * ── Rule 1: this suite performs NO WRITES ──────────────────────────────────────────
 * The app this points at talks to a live production accounting database — there is no
 * test database. A void, a delete, an archive, a status change or a payment recorded by
 * this suite would be a real change to the company's books. Every test here opens a
 * dialog, checks what it offers or refuses, and closes it with Cancel. No test clicks a
 * "Void This Invoice", "Delete Permanently", "Confirm Change", "Archive" or "Record
 * Payment" button. If a write-path test is ever wanted (e.g. proving a void actually
 * posts a reversing journal entry), it needs a disposable draft invoice created and torn
 * down by the test itself, plus an explicit opt-in env var (e.g. E2E_ALLOW_WRITES=true)
 * — neither exists today, and this file does not attempt it.
 *
 * ── Rule 2: this suite NEVER handles credentials ───────────────────────────────────
 * No username or password is written here, read from a config file, or invented. They
 * come only from environment variables the person running the suite sets themselves:
 *
 *   E2E_BASE_URL  optional, defaults to http://localhost:3000 (set in playwright.config.ts)
 *   E2E_USER      the login email of an account on the running app
 *   E2E_PASSWORD  that account's password
 *
 * When E2E_USER or E2E_PASSWORD is missing, every test below skips cleanly (via
 * `test.beforeEach`) with a message explaining why — it never falls through to a login
 * form with an empty password and hangs.
 *
 * The account's actual permission level decides which branch several tests below run:
 * see "Void/Delete are gated by permission" for the one that says so explicitly and
 * reports (as a test annotation) which branch actually ran.
 *
 * ── Sign-in happens once, not once per test ─────────────────────────────────────────
 * The backend throttles `/auth/login` to five attempts per fifteen minutes per IP
 * (`@Throttle(5, 15 * 60 * 1000)` on `backend/src/auth/auth.controller.ts`) — a
 * deliberate brute-force guard. With `fullyParallel` and several workers, a test suite
 * where every test calls a `login()` helper makes one login attempt per test, per run,
 * from the same IP — enough to trip that guard on its own. Tests below no longer log in
 * themselves: `e2e/auth.setup.ts` runs once, first, as its own Playwright project, signs
 * in through the real form exactly one time, and saves the resulting session so every
 * test in the `chromium` project starts already authenticated (see `storageState` /
 * `dependencies` in `playwright.config.ts`). A test that needs the login form itself (none
 * currently do) would still drive it directly rather than adding a second login call.
 */

const CREDS_PRESENT = Boolean(process.env.E2E_USER && process.env.E2E_PASSWORD);
const SKIP_REASON =
  'E2E_USER / E2E_PASSWORD are not set — skipping the invoice lifecycle suite. ' +
  'See frontend/src/test-support/README.md for how to run it.';

test.beforeEach(() => {
  test.skip(!CREDS_PRESENT, SKIP_REASON);
});

// ── Shared helpers ────────────────────────────────────────────────────────────────

interface InvoiceRef {
  id: string;
  invoiceNumber: string;
  status: string;
}

/**
 * Sets the invoices list's status filter to each status in turn (first match wins) and
 * returns the id/number/status of the first row found, or null if none of them have any
 * invoices at all in this environment. Used instead of hard-coding an invoice id, since
 * this suite must run against whatever the live database actually contains.
 */
async function findFirstInvoiceByStatus(page: Page, statuses: string[]): Promise<InvoiceRef | null> {
  await page.goto('/finance/invoices');
  await page.waitForLoadState('networkidle');
  const statusFilter = page.locator('select'); // the only <select> on this page
  const openLinks = page.getByRole('link', { name: /^Open$/ });

  for (const status of statuses) {
    await statusFilter.selectOption(status);
    await page.waitForLoadState('networkidle');
    if ((await openLinks.count()) === 0) continue;
    const href = await openLinks.first().getAttribute('href');
    if (!href) continue;
    const id = href.split('/').filter(Boolean).pop()!;
    const invoiceNumber = (await page.locator('tbody tr').first().locator('td').first().innerText()).trim();
    return { id, invoiceNumber, status };
  }
  return null;
}

/** Opens an invoice's detail page and waits for its (async, permission-gated) toolbar to settle. */
async function openInvoiceDetail(page: Page, id: string): Promise<void> {
  await page.goto(`/finance/invoices/${id}`);
  await page.waitForLoadState('networkidle');
}

const moreMenuButton = (page: Page) => page.getByRole('button', { name: 'More', exact: true });

// ── The restored session actually works ──────────────────────────────────────────────

test('the restored sign-in session lands on the invoice list, not the login page', async ({ page }) => {
  // No login() call here — the "chromium" project's storageState (written once by
  // e2e/auth.setup.ts) is what's actually under test: if it failed to restore, the app
  // would redirect this anonymous-looking request to /login instead of serving the list.
  await page.goto('/finance/invoices');
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible();
  await expect(page.locator('table')).toBeVisible();
});

// ── The back door stays shut ─────────────────────────────────────────────────────────

test('Change Status never offers Voided — voiding an invoice must always go through the Void dialog', async ({ page }) => {
  // Voiding posts a reversing journal entry and requires a re-typed password; the generic
  // Change Status modal is driven by WORKFLOW_TRANSITIONS (src/lib/statusConfig.ts), which
  // must never list VOIDED as a target for any status. This is the UI-level check of that
  // rule — invoice-lifecycle.logic.test.ts already proves it at the config-table level.
  const target = await findFirstInvoiceByStatus(page, ['SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'DRAFT']);
  test.skip(!target, 'No non-voided invoice exists in this environment to open Change Status on.');

  await openInvoiceDetail(page, target!.id);
  await page.getByRole('button', { name: 'Change Status', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Change Status', exact: true })).toBeVisible();

  // \bvoided\b (not a bare "Voided" exact match) so this can't accidentally pass because the
  // button's accessible name also includes its emoji icon glyph run together with the label.
  await expect(page.getByRole('button', { name: /\bvoided\b/i })).toHaveCount(0);

  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Change Status', exact: true })).toHaveCount(0);
});

// ── The archived filter ──────────────────────────────────────────────────────────────

test('the archived filter is off by default, and the default list request never asks the server for archived invoices', async ({ page }) => {
  const [response] = await Promise.all([
    page.waitForResponse(r => r.request().method() === 'GET' && new URL(r.url()).pathname.endsWith('/finance/invoices')),
    page.goto('/finance/invoices'),
  ]);
  const requestUrl = new URL(response.url());
  // The list page only sends `archived` at all once the checkbox is ticked (params:
  // { archived: showArchived ? 'true' : undefined }, and axios drops undefined params
  // entirely) — so the key's absence here, not merely being "false", is the real assertion.
  expect(requestUrl.searchParams.has('archived')).toBe(false);

  await expect(page.getByLabel('Show archived invoices')).not.toBeChecked();
});

test('an archived invoice, if one exists, shows its Archived tag once the filter is switched on', async ({ page }) => {
  await page.goto('/finance/invoices');
  await page.waitForLoadState('networkidle');

  await page.getByLabel('Show archived invoices').check();
  await page.waitForLoadState('networkidle');

  const archivedTags = page.getByText('Archived', { exact: true });
  const count = await archivedTags.count();
  test.skip(count === 0, 'No archived invoice exists in this environment to check the Archived tag on.');
  await expect(archivedTags.first()).toBeVisible();
});

// ── Permission gating ────────────────────────────────────────────────────────────────

test('Void/Delete are gated by permission: shown with Delete disabled off-DRAFT/CANCELLED, or the whole menu is absent', async ({ page }) => {
  // SENT/PARTIALLY_PAID/PAID/OVERDUE: never DRAFT/CANCELLED (so Delete must read as
  // disabled if the menu is visible at all) and never VOIDED (so Void is always offered).
  const target = await findFirstInvoiceByStatus(page, ['SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE']);
  test.skip(!target, 'No SENT/PARTIALLY_PAID/PAID/OVERDUE invoice exists in this environment to check permission gating on.');

  await openInvoiceDetail(page, target!.id);
  const visible = await moreMenuButton(page).isVisible().catch(() => false);
  test.info().annotations.push({
    type: 'permission-branch',
    description: visible
      ? `signed-in account CAN see Void/Delete (finance:3) — checked on invoice ${target!.invoiceNumber} (${target!.status})`
      : `signed-in account CANNOT see Void/Delete (finance:3) — More menu is absent, as required`,
  });

  if (visible) {
    await moreMenuButton(page).click();
    await expect(page.getByRole('button', { name: /Void Invoice/i })).toBeVisible();
    const deleteItem = page.getByRole('button', { name: /Delete Invoice/i });
    await expect(deleteItem).toBeVisible();
    // isInvoiceDeletable() (invoice-lifecycle.logic.ts) only allows DRAFT/CANCELLED —
    // this invoice is neither, so Delete must render disabled, not merely absent.
    await expect(deleteItem).toBeDisabled();
    // Close the dropdown without touching either action.
    await page.keyboard.press('Escape');
  } else {
    await expect(moreMenuButton(page)).toHaveCount(0);
  }
});

// ── The dialogs refuse bad input ─────────────────────────────────────────────────────

test('Void refuses to submit with an empty reason and an empty password', async ({ page }) => {
  const target = await findFirstInvoiceByStatus(page, ['SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'DRAFT', 'CANCELLED']);
  test.skip(!target, 'No non-voided invoice exists in this environment to open Void on.');

  await openInvoiceDetail(page, target!.id);
  const hasMenu = await moreMenuButton(page).isVisible().catch(() => false);
  test.skip(!hasMenu, 'Signed-in account lacks finance:3 (Void/Delete are not shown) — nothing to test here.');

  await moreMenuButton(page).click();
  await page.getByRole('button', { name: /Void Invoice/i }).click();
  await expect(page.getByRole('heading', { name: /^Void invoice/ })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Void This Invoice', exact: true })).toBeDisabled();

  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Void invoice/ })).toHaveCount(0);
});

test('Delete refuses to submit until the invoice number is typed back exactly, and a wrong number keeps it refused', async ({ page }) => {
  // Only a DRAFT or CANCELLED invoice's Delete item is clickable at all (see the
  // permission-gating test above for the disabled case) — this test needs the dialog to
  // actually open, so it deliberately picks from the deletable statuses instead.
  const target = await findFirstInvoiceByStatus(page, ['DRAFT', 'CANCELLED']);
  test.skip(!target, 'No DRAFT or CANCELLED invoice exists in this environment — Delete is refused for every other status, so the dialog cannot be opened.');

  await openInvoiceDetail(page, target!.id);
  const hasMenu = await moreMenuButton(page).isVisible().catch(() => false);
  test.skip(!hasMenu, 'Signed-in account lacks finance:3 (Void/Delete are not shown) — nothing to test here.');

  await moreMenuButton(page).click();
  const deleteItem = page.getByRole('button', { name: /Delete Invoice/i });
  await expect(deleteItem).toBeEnabled();
  await deleteItem.click();
  await expect(page.getByRole('heading', { name: /^Permanently delete invoice/ })).toBeVisible();

  const confirmBtn = page.getByRole('button', { name: 'Delete Permanently', exact: true });
  await expect(confirmBtn).toBeDisabled();

  // The confirm-number input has no `for`/`id` link to its <label> either (see report),
  // so it's located off the visible label text plus its DOM position — the label and
  // input are direct siblings in the markup.
  const confirmNumberInput = page
    .locator('label', { hasText: 'Type the invoice number to confirm' })
    .locator('xpath=following-sibling::input[1]');
  const passwordInput = page
    .locator('label', { hasText: "Confirm it's you" })
    .locator('xpath=following-sibling::input[1]');

  await page.getByPlaceholder(/duplicate draft, entered by mistake, wrong client/i).fill('e2e read-only check — not a real deletion');
  await passwordInput.fill('not-a-real-password');
  await confirmNumberInput.fill(`${target!.invoiceNumber}-WRONG`);
  await expect(confirmBtn).toBeDisabled();

  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Permanently delete invoice/ })).toHaveCount(0);
});

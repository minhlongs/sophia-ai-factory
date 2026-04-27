/**
 * Payout Processor
 * Atomic mark-paid operation using D1 UPDATE-RETURNING.
 * Validates threshold, updates conversions, inserts payout record.
 */

import { logger } from '@/lib/utils/logger-utility';
import { rebuildUserWallet } from './wallet-rebuilder';
import { MIN_PAYOUT_USD, type PayoutMethod } from './payout-validators';

interface MarkPaidParams {
  userId: string;
  amount: number;
  method: PayoutMethod;
  reference: string;
  adminId: string;
  notes?: string;
}

/** Get raw D1Database binding from CF worker environment. */
function getD1Binding(): D1Database {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
  if (env?.DB) return env.DB as D1Database;

  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;

  throw new Error('D1 database binding not available');
}

function generateId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Mark a user's available balance as paid. Atomic UPDATE-RETURNING + reconciliation. */
export async function markUserPaid(params: MarkPaidParams): Promise<{ payoutId: string }> {
  const { userId, amount, method, reference, adminId, notes } = params;

  if (amount < MIN_PAYOUT_USD) {
    throw new Error(`Amount $${amount} is below minimum payout threshold $${MIN_PAYOUT_USD}`);
  }

  const db = getD1Binding();
  const payoutId = generateId();
  const now = Math.floor(Date.now() / 1000);

  // Atomically mark all available conversions as paid, returning their commission amounts.
  // This eliminates the SELECT-then-UPDATE race window where cron or new conversion
  // could change state between the two queries.
  const updateRes = await db
    .prepare(
      `UPDATE affiliate_conversions
       SET payout_status = 'paid', paid_at = ?, payout_id = ?
       WHERE user_id = ? AND payout_status = 'available'
       RETURNING commission_user`
    )
    .bind(now, payoutId, userId)
    .all<{ commission_user: number }>();

  const results = updateRes.results ?? [];

  if (results.length === 0) {
    throw new Error(`No wallet found for user ${userId}`);
  }

  const actualPaid = results.reduce((sum, r) => sum + r.commission_user, 0);

  // Verify sum matches expected amount within IEEE-754 tolerance (±0.01)
  if (Math.abs(actualPaid - amount) > 0.01) {
    // Reconcile: revert all conversions back to available
    await db
      .prepare(
        `UPDATE affiliate_conversions
         SET payout_status = 'available', paid_at = NULL, payout_id = NULL
         WHERE payout_id = ?`
      )
      .bind(payoutId)
      .run();

    throw new Error(
      `Amount $${amount} does not match available balance $${actualPaid} — whole-balance payout only`
    );
  }

  // Insert payout record with the actual amount that was marked
  await db
    .prepare(
      `INSERT INTO payouts (id, user_id, amount, currency, method, reference, notes, paid_by_admin, created_at)
       VALUES (?, ?, ?, 'USD', ?, ?, ?, ?, datetime('now'))`
    )
    .bind(payoutId, userId, actualPaid, method, reference, notes ?? null, adminId)
    .run();

  // Rebuild wallet so balance_available goes to 0 immediately
  try {
    await rebuildUserWallet(userId);
  } catch (err) {
    logger.warn('[payout-processor] Wallet rebuild after mark-paid failed (non-fatal)', {
      userId,
      payoutId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info('[payout-processor] Payout marked', { payoutId, userId, amount, method });
  return { payoutId };
}

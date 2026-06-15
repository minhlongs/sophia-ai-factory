/**
 * Wallet Rebuilder
 * Rebuilds the denormalized user_wallets table from affiliate_conversions.
 * Excludes TEST event_type from all balance calculations.
 */

import { logger } from '@/seed/utils/logger-utility';

interface WalletBalances {
  balance_pending: number;
  balance_available: number;
  balance_paid_out: number;
}

interface BalanceRow {
  payout_status: string;
  total: number;
}

interface UserIdRow {
  user_id: string;
}

/** Get raw D1Database binding from CF worker environment. */
function getD1Binding(): D1Database {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
  if (env?.DB) return env.DB as D1Database;

  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;

  throw new Error('D1 database binding not available');
}

/** Compute balance buckets for a single user from affiliate_conversions. */
async function computeUserBalances(userId: string): Promise<WalletBalances> {
  const db = getD1Binding();

  const { results } = await db
    .prepare(
      `SELECT payout_status, SUM(commission_user) AS total
       FROM affiliate_conversions
       WHERE user_id = ? AND event_type != 'TEST'
       GROUP BY payout_status`
    )
    .bind(userId)
    .all<BalanceRow>();

  const balances: WalletBalances = {
    balance_pending: 0,
    balance_available: 0,
    balance_paid_out: 0,
  };

  for (const row of results ?? []) {
    if (row.payout_status === 'pending_clearance') {
      balances.balance_pending = row.total ?? 0;
    } else if (row.payout_status === 'available') {
      balances.balance_available = row.total ?? 0;
    } else if (row.payout_status === 'paid') {
      balances.balance_paid_out = row.total ?? 0;
    }
  }

  return balances;
}

/** Rebuild wallet for a single user — used after mark-paid to keep wallet fresh. */
export async function rebuildUserWallet(userId: string): Promise<void> {
  const db = getD1Binding();
  const balances = await computeUserBalances(userId);

  await db
    .prepare(
      `INSERT INTO user_wallets (user_id, balance_pending, balance_available, balance_paid_out, last_rebuilt_at, updated_at)
       VALUES (?, ?, ?, ?, unixepoch(), datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         balance_pending = excluded.balance_pending,
         balance_available = excluded.balance_available,
         balance_paid_out = excluded.balance_paid_out,
         last_rebuilt_at = excluded.last_rebuilt_at,
         updated_at = excluded.updated_at`
    )
    .bind(
      userId,
      balances.balance_pending,
      balances.balance_available,
      balances.balance_paid_out
    )
    .run();

  logger.info('[wallet-rebuilder] Rebuilt wallet', { userId, ...balances });
}

/** Rebuild wallets for all users that have any affiliate_conversions row. */
export async function rebuildAllWallets(): Promise<{ count: number }> {
  const db = getD1Binding();

  const { results } = await db
    .prepare(
      `SELECT DISTINCT user_id FROM affiliate_conversions WHERE user_id IS NOT NULL`
    )
    .all<UserIdRow>();

  const userIds = (results ?? []).map((r) => r.user_id);
  let count = 0;

  for (const userId of userIds) {
    try {
      await rebuildUserWallet(userId);
      count++;
    } catch (err) {
      logger.error('[wallet-rebuilder] Failed to rebuild wallet', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('[wallet-rebuilder] Rebuild complete', { count, total: userIds.length });
  return { count };
}

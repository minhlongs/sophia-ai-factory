/**
 * Admin Payouts Dashboard
 *
 * Server Component: fetches payout queue from D1 directly.
 * Renders list of users with balance_available >= $50, with mark-paid form per row.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import { logger } from '@/seed/utils/logger-utility';
import { MIN_PAYOUT_USD } from '@/lib/wallet/payout-validators';
import { PayoutRow } from './payout-row';

export const dynamic = 'force-dynamic';

interface WalletRow {
  user_id: string;
  balance_available: number;
  balance_pending: number;
  currency: string;
  last_rebuilt_at: number | null;
}

function getD1Binding(): D1Database {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
  if (env?.DB) return env.DB as D1Database;
  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;
  throw new Error('D1 database binding not available');
}

async function fetchPayoutQueue(): Promise<WalletRow[]> {
  try {
    const db = getD1Binding();
    const { results } = await db
      .prepare(
        `SELECT user_id, balance_available, balance_pending, currency, last_rebuilt_at
         FROM user_wallets
         WHERE balance_available >= ?
         ORDER BY balance_available DESC
         LIMIT 50`
      )
      .bind(MIN_PAYOUT_USD)
      .all<WalletRow>();
    return results ?? [];
  } catch (err) {
    logger.error('[admin/payouts] Failed to fetch queue', err instanceof Error ? err : new Error(String(err)));
    return [];
  }
}

export default async function AdminPayoutsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    redirect('/dashboard');
  }

  const queue = await fetchPayoutQueue();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Payout Queue</h1>
        <p className="text-muted-foreground">
          Users with available balance ≥ ${MIN_PAYOUT_USD} USD ready for manual payout.
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground text-lg">No users ready for payout</p>
          <p className="text-sm text-muted-foreground mt-2">
            Minimum threshold: ${MIN_PAYOUT_USD} USD available balance
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <p className="text-sm text-muted-foreground">
              {queue.length} user{queue.length !== 1 ? 's' : ''} pending payout
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">
                    User ID
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">
                    Available
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">
                    Pending
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <PayoutRow key={item.user_id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

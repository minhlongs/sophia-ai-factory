/**
 * User Wallet Page — /dashboard/wallet
 *
 * Server Component: fetches wallet balances and recent conversions from D1.
 * Displays 3 balance cards (pending / available / paid out) + transactions table.
 */

import { getCurrentUser } from '@/lib/better-auth-session';
import { redirect } from 'next/navigation';
import { logger } from '@/lib/utils/logger-utility';

export const dynamic = 'force-dynamic';

interface WalletData {
  balance_pending: number;
  balance_available: number;
  balance_paid_out: number;
  currency: string;
  last_rebuilt_at: number | null;
  recent_conversions: ConversionRow[];
}

interface ConversionRow {
  id: string;
  event_type: string;
  gross_amount: number;
  commission_user: number;
  currency: string;
  payout_status: string;
  offer_id: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending_clearance: 'Clearing',
  available: 'Available',
  paid: 'Paid',
  reversed: 'Reversed',
  unattributed: 'Unattributed',
};

const STATUS_COLORS: Record<string, string> = {
  pending_clearance: 'text-yellow-400',
  available: 'text-green-400',
  paid: 'text-[var(--neon-cyan)]',
  reversed: 'text-red-400',
  unattributed: 'text-muted-foreground',
};

function getD1Binding(): D1Database {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
  if (env?.DB) return env.DB as D1Database;
  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;
  throw new Error('D1 database binding not available');
}

async function fetchWalletData(userId: string): Promise<WalletData> {
  try {
    const db = getD1Binding();

    const wallet = await db
      .prepare(`SELECT * FROM user_wallets WHERE user_id = ?`)
      .bind(userId)
      .first<Omit<WalletData, 'recent_conversions'>>();

    const { results: recentConversions } = await db
      .prepare(
        `SELECT id, event_type, gross_amount, commission_user, currency, payout_status, offer_id, created_at
         FROM affiliate_conversions
         WHERE user_id = ? AND event_type != 'TEST'
         ORDER BY created_at DESC
         LIMIT 20`
      )
      .bind(userId)
      .all<ConversionRow>();

    return {
      balance_pending: wallet?.balance_pending ?? 0,
      balance_available: wallet?.balance_available ?? 0,
      balance_paid_out: wallet?.balance_paid_out ?? 0,
      currency: wallet?.currency ?? 'USD',
      last_rebuilt_at: wallet?.last_rebuilt_at ?? null,
      recent_conversions: recentConversions ?? [],
    };
  } catch (err) {
    logger.error('[dashboard/wallet] Failed to fetch wallet data', err instanceof Error ? err : new Error(String(err)));
    return {
      balance_pending: 0, balance_available: 0, balance_paid_out: 0,
      currency: 'USD', last_rebuilt_at: null, recent_conversions: [],
    };
  }
}

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const data = await fetchWalletData(user.id);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">My Wallet</h1>
        <p className="text-muted-foreground">Your affiliate earnings and payout history</p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">
            Pending Clearance
          </p>
          <p className="text-3xl font-bold text-yellow-400">
            ${data.balance_pending.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">60-day hold window</p>
        </div>

        <div className="bg-card border border-[var(--neon-cyan)]/30 rounded-xl p-6">
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">
            Available for Payout
          </p>
          <p className="text-3xl font-bold text-[var(--neon-cyan)]">
            ${data.balance_available.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">Min. payout $50 USD</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">
            Total Paid Out
          </p>
          <p className="text-3xl font-bold text-foreground">
            ${data.balance_paid_out.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">Lifetime earnings</p>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Recent Transactions</h2>
        </div>

        {data.recent_conversions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">No transactions yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Earnings appear here after your first conversion
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Gross</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Your Cut</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_conversions.map((row) => (
                  <tr key={row.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">{row.event_type}</td>
                    <td className="py-3 px-4 text-sm text-foreground">
                      ${row.gross_amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-[var(--neon-cyan)]">
                      ${row.commission_user.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium ${STATUS_COLORS[row.payout_status] ?? 'text-muted-foreground'}`}>
                        {STATUS_LABELS[row.payout_status] ?? row.payout_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

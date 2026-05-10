/**
 * Affiliate Dashboard — /dashboard/affiliate
 *
 * Server Component. Renders for the authenticated affiliate:
 *  - Summary stats (clicks, conversions, EPC, commission) over last 30 days
 *  - Recent conversion feed (latest 50)
 *  - CSV export action
 *
 * Data primitives: `getAffiliateClickStats`, `getRecentConversions` from `@/land/affiliates/dashboard-stats`.
 * Uses canonical Sophia tier-gated dashboard pattern (server-fetched, dynamic rendering).
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import {
  getAffiliateClickStats,
  getRecentConversions,
  type ConversionFeedRow,
} from '@/land/affiliates/dashboard-stats';
import { getEarningsSummary } from '@/land/payouts/commission-ledger';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<ConversionFeedRow['status'], string> = {
  pending: 'text-yellow-400',
  approved: 'text-green-400',
  rejected: 'text-red-400',
  paid: 'text-[var(--neon-cyan)]',
};

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtDate(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

export default async function AffiliateDashboardPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const now = Math.floor(Date.now() / 1000);
  const fromTs = now - 30 * 86400;

  const [stats, conversions, earnings] = await Promise.all([
    getAffiliateClickStats(user.id, user.id, fromTs, now),
    getRecentConversions(user.id, user.id, 50, 0),
    getEarningsSummary(user.id, user.id, fromTs, now),
  ]);

  const pendingEarnings = earnings
    .filter((e) => e.status === 'pending' || e.status === 'payable')
    .reduce((sum, e) => sum + e.total_usd, 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Affiliate Dashboard</h1>
          <p className="text-muted-foreground">Last 30 days · per-click and conversion performance.</p>
        </div>
        <a
          href="/api/affiliate/conversions/csv?limit=500"
          className="inline-flex items-center gap-2 rounded-md border border-[var(--neon-cyan)]/40 bg-[var(--neon-cyan)]/10 px-4 py-2 text-sm font-medium text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/20 transition"
          download
        >
          Export CSV
        </a>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Clicks" value={stats.totalClicks.toLocaleString()} hint="last 30d" />
        <StatCard label="Conversions" value={stats.totalConversions.toLocaleString()} hint="last 30d" />
        <StatCard label="EPC" value={fmtUsd(stats.epc)} hint="commission ÷ clicks" />
        <StatCard label="Pending earnings" value={fmtUsd(pendingEarnings)} hint="approved + payable" />
      </section>

      <section className="rounded-lg border border-border bg-card">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Recent Conversions</h2>
          <span className="text-xs text-muted-foreground">
            {conversions.length} of latest 50
          </span>
        </header>

        {conversions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No conversions yet. Share your affiliate link to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Recent affiliate conversions, newest first</caption>
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">When</th>
                  <th scope="col" className="px-4 py-3 font-medium">Offer</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Gross</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Commission</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {conversions.map((c) => (
                  <tr key={c.conversionId} className="border-t border-border">
                    <td className="px-4 py-3 font-mono text-xs">{fmtDate(c.attributedAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.offerId}</td>
                    <td className="px-4 py-3 text-right">{fmtUsd(c.grossAmountUsd)}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmtUsd(c.commissionUsd)}</td>
                    <td className={`px-4 py-3 ${STATUS_COLORS[c.status]}`}>
                      <span aria-label={`status: ${c.status}`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

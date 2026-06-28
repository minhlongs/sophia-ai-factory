// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
/**
 * /dashboard/admin/affiliate-leaderboard — Top affiliates by performance metric.
 *
 * Server Component. Sortable via `?sortBy=epc|conversions|commission`,
 * default 30-day window. Hides the underlying affiliate user_id when there's
 * a known email/name; falls back to the ID when missing.
 */

import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import {
  getTopAffiliates,
  type LeaderboardRow,
  type LeaderboardSortBy,
} from '@/land/affiliates/leaderboard';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sortBy?: string }>;
}

const VALID_SORT: ReadonlyArray<LeaderboardSortBy> = ['epc', 'conversions', 'commission'];

const SORT_LABEL: Record<LeaderboardSortBy, string> = {
  epc: 'EPC',
  conversions: 'Conversions',
  commission: 'Commission $',
};

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default async function AffiliateLeaderboardPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  await params;
  await requireMasterTier();

  const { sortBy: sortRaw } = await searchParams;
  const sortBy: LeaderboardSortBy = VALID_SORT.includes(sortRaw as LeaderboardSortBy)
    ? (sortRaw as LeaderboardSortBy)
    : 'epc';

  const now = Math.floor(Date.now() / 1000);
  const fromTs = now - 30 * 86400;

  let rows: LeaderboardRow[] = [];
  let queryError: string | null = null;
  try {
    rows = await getTopAffiliates(fromTs, now, 25, sortBy);
  } catch (err) {
    queryError = String(err);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <Trophy className="w-6 h-6 text-primary-400 mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">Affiliate Leaderboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Top 25 affiliates · last 30 days. Click a sort chip to reorder.
          </p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Sort by">
        {VALID_SORT.map((key) => (
          <Link
            key={key}
            href={`/dashboard/admin/affiliate-leaderboard?sortBy=${key}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              sortBy === key
                ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)]'
                : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
            }`}
          >
            {SORT_LABEL[key]}
          </Link>
        ))}
      </nav>

      {queryError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load leaderboard: {queryError}
        </div>
      )}

      {rows.length === 0 && !queryError ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          No affiliate activity in the last 30 days.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Top affiliates by {SORT_LABEL[sortBy]}</caption>
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium w-10 text-right">#</th>
                <th scope="col" className="px-4 py-3 font-medium">Affiliate</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Clicks</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Conversions</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Commission</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">EPC</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.affiliateId} className="border-t border-border align-top">
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {r.name ?? r.email ?? '—'}
                    </div>
                    <code className="text-[11px] font-mono text-muted-foreground">
                      {r.email ?? r.affiliateId}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {r.totalClicks.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {r.totalConversions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {fmtUsd(r.totalCommissionUsd)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {fmtUsd(r.epc)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

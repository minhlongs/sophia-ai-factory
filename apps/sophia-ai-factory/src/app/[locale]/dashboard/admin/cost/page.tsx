// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
/**
 * /dashboard/admin/cost — Provider cost dashboard (admin only).
 *
 * Server Component. Renders 30-day snapshot:
 *   - Global summary cards (total, monthly projection, units, jobs)
 *   - By-stage breakdown
 *   - By-provider breakdown
 *   - Top tenants by cost
 *
 * Data source: `getCostSnapshot` from `@/land/observability/cost-snapshot`.
 */

import Link from 'next/link';
import { Coins } from 'lucide-react';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import {
  getCostSnapshot,
  type CostSnapshot,
} from '@/land/observability/cost-snapshot';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function pct(part: number, total: number): string {
  if (total <= 0) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

export default async function CostDashboardPage({ params }: PageProps): Promise<React.JSX.Element> {
  await params;
  await requireMasterTier();

  const now = Math.floor(Date.now() / 1000);
  const fromTs = now - 30 * 86400;

  let snapshot: CostSnapshot | null = null;
  let queryError: string | null = null;
  try {
    snapshot = await getCostSnapshot(fromTs, now, 25);
  } catch (err) {
    queryError = String(err);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <Coins className="w-6 h-6 text-violet-400 mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">Cost Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Provider spend recorded by the video pipeline · last 30 days. Use the
            stage + provider breakdowns to spot regressions or routing issues; the
            top-tenants table flags accounts likely to need quota review.
          </p>
        </div>
      </header>

      {queryError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load cost snapshot: {queryError}
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="30d cost" value={fmtUsd(snapshot?.global.totalCostUsd ?? 0)} />
        <StatCard
          label="Monthly projection"
          value={fmtUsd(snapshot?.monthlyProjectionUsd ?? 0)}
          hint="extrapolated"
        />
        <StatCard label="Cost lines" value={(snapshot?.global.lineCount ?? 0).toLocaleString()} />
        <StatCard label="Jobs billed" value={(snapshot?.global.jobCount ?? 0).toLocaleString()} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Breakdown
          title="By stage"
          rows={snapshot?.byStage ?? []}
          total={snapshot?.global.totalCostUsd ?? 0}
        />
        <Breakdown
          title="By provider"
          rows={snapshot?.byProvider ?? []}
          total={snapshot?.global.totalCostUsd ?? 0}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Top tenants by cost
        </h2>
        {snapshot && snapshot.topTenants.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm">
            No tenant cost activity in the last 30 days.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">Top tenants by 30-day provider cost</caption>
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium w-10 text-right">#</th>
                  <th scope="col" className="px-4 py-3 font-medium">Tenant</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Cost</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">% of total</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Jobs</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Lines</th>
                  <th scope="col" className="px-4 py-3 font-medium">Lookup</th>
                </tr>
              </thead>
              <tbody>
                {(snapshot?.topTenants ?? []).map((t, i) => (
                  <tr key={t.tenantId} className="border-t border-border align-top">
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {i + 1}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs truncate max-w-[260px]" title={t.tenantId}>
                      {t.tenantId}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{fmtUsd(t.costUsd)}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {pct(t.costUsd, snapshot?.global.totalCostUsd ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{t.jobCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono">{t.lineCount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/admin/tenant-lookup?tenantId=${encodeURIComponent(t.tenantId)}`}
                        className="text-xs text-[var(--neon-cyan)] hover:underline"
                      >
                        open →
                      </Link>
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

function Breakdown({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { bucket: string; costUsd: number; lineCount: number }[];
  total: number;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card">
      <header className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
      </header>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground text-sm">
          No spend recorded in window.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Bucket</th>
              <th scope="col" className="px-4 py-2 font-medium text-right">Cost</th>
              <th scope="col" className="px-4 py-2 font-medium text-right">% total</th>
              <th scope="col" className="px-4 py-2 font-medium text-right">Lines</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bucket} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs">{r.bucket}</td>
                <td className="px-4 py-2 text-right font-mono">{fmtUsd(r.costUsd)}</td>
                <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                  {pct(r.costUsd, total)}
                </td>
                <td className="px-4 py-2 text-right font-mono">{r.lineCount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

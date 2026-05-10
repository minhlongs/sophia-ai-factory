/**
 * /dashboard/admin/storage — R2 storage usage monitor (admin only).
 *
 * Server Component. Surfaces global storage totals + top-25 tenants by
 * bytes consumed + stale recalc count (rows whose last_calculated_at is
 * older than 24h — the recalc job may be lagging).
 *
 * Data source: `getStorageSnapshot` from
 * `@/land/observability/storage-usage-stats`.
 */

import { redirect } from 'next/navigation';
import { Database } from 'lucide-react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  getStorageSnapshot,
  type StorageSnapshot,
  type TenantStorageRow,
} from '@/land/observability/storage-usage-stats';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;
const TB = GB * 1024;

function fmtBytes(bytes: number): string {
  if (bytes >= TB) return `${(bytes / TB).toFixed(2)} TB`;
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${bytes} B`;
}

function fmtAge(ageSec: number): string {
  if (ageSec < 60) return `${ageSec}s ago`;
  if (ageSec < 3600) return `${Math.round(ageSec / 60)}m ago`;
  if (ageSec < 86400) return `${Math.round(ageSec / 3600)}h ago`;
  return `${Math.round(ageSec / 86400)}d ago`;
}

const STALE_BADGE = 'bg-amber-500/15 text-amber-300 border-amber-500/30';

export default async function StorageMonitorPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') redirect(`/${locale}/dashboard`);

  let snapshot: StorageSnapshot | null = null;
  let queryError: string | null = null;
  try {
    snapshot = await getStorageSnapshot(25);
  } catch (err) {
    queryError = String(err);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <Database className="w-6 h-6 text-violet-400 mt-1 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold">R2 Storage Usage</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Per-tenant byte counts maintained by the recalc job. Stale = row not
            recomputed in 24h+; top consumers shown by descending bytes.
          </p>
        </div>
      </header>

      {queryError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load storage stats: {queryError}
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Tenants tracked" value={(snapshot?.global.tenantCount ?? 0).toLocaleString()} />
        <SummaryCard label="Total bytes" value={fmtBytes(snapshot?.global.totalBytes ?? 0)} />
        <SummaryCard label="Total videos" value={(snapshot?.global.totalVideos ?? 0).toLocaleString()} />
        <SummaryCard
          label="Stale (>24h)"
          value={(snapshot?.global.staleTenantCount ?? 0).toLocaleString()}
          tone={(snapshot?.global.staleTenantCount ?? 0) > 0 ? 'warn' : 'ok'}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Top consumers
        </h2>
        {snapshot && snapshot.topTenants.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-sm">
            No tenants tracked yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">Top tenants by R2 bytes consumed</caption>
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium w-10 text-right">#</th>
                  <th scope="col" className="px-4 py-3 font-medium">Tenant</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Bytes</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Videos</th>
                  <th scope="col" className="px-4 py-3 font-medium">Last recalc</th>
                </tr>
              </thead>
              <tbody>
                {(snapshot?.topTenants ?? []).map((t, i) => (
                  <TenantRow key={t.tenantId} index={i} row={t} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function TenantRow({ index, row }: { index: number; row: TenantStorageRow }): React.JSX.Element {
  const isStale = row.ageSec > 24 * 3600;
  return (
    <tr className="border-t border-border align-top">
      <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{index + 1}</td>
      <td className="px-4 py-3 font-mono text-xs truncate max-w-[260px]" title={row.tenantId}>
        {row.tenantId}
      </td>
      <td className="px-4 py-3 text-right font-mono font-semibold">{fmtBytes(row.totalBytes)}</td>
      <td className="px-4 py-3 text-right font-mono">{row.videoCount.toLocaleString()}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          {fmtAge(row.ageSec)}
          {isStale && (
            <span className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded border ${STALE_BADGE}`}>
              stale
            </span>
          )}
        </span>
      </td>
    </tr>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'ok',
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad';
}): React.JSX.Element {
  const valueClass =
    tone === 'bad' ? 'text-red-300' : tone === 'warn' ? 'text-amber-300' : 'text-foreground';
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

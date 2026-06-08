// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
/**
 * /dashboard/admin/api-key-usage — Per-key request volume + error rate + latency.
 *
 * Server Component. Renders top-50 API keys by 30-day request volume.
 * Highlights revoked keys (is_active=0) + dormant keys (no usage in window)
 * + high-error keys (errorRate > 5%).
 */

import { KeyRound } from 'lucide-react';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import {
  getApiKeyUsageStats,
  type ApiKeyUsageRow,
} from '@/land/observability/api-key-usage-stats';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

const ERROR_THRESHOLD = 0.05;

function fmtNum(n: number): string {
  return n.toLocaleString();
}

function fmtPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'never';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const ageSec = Math.floor((Date.now() - ts) / 1000);
  if (ageSec < 60) return `${ageSec}s ago`;
  if (ageSec < 3600) return `${Math.round(ageSec / 60)}m ago`;
  if (ageSec < 86400) return `${Math.round(ageSec / 3600)}h ago`;
  return `${Math.round(ageSec / 86400)}d ago`;
}

export default async function ApiKeyUsagePage({ params }: PageProps): Promise<React.JSX.Element> {
  await params;
  await requireMasterTier();

  const now = Math.floor(Date.now() / 1000);
  const fromTs = now - 30 * 86400;

  let rows: ApiKeyUsageRow[] = [];
  let queryError: string | null = null;
  try {
    rows = await getApiKeyUsageStats(fromTs, now, 50);
  } catch (err) {
    queryError = String(err);
  }

  const totalKeys = rows.length;
  const activeKeys = rows.filter((r) => r.isActive).length;
  const dormantKeys = rows.filter((r) => r.requestCount === 0).length;
  const highErrorKeys = rows.filter((r) => r.errorRate > ERROR_THRESHOLD).length;
  const totalRequests = rows.reduce((sum, r) => sum + r.requestCount, 0);

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <KeyRound className="w-6 h-6 text-primary-400 mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">API Key Usage</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Top 50 keys · last 30 days. Dormant rows are inactive integrations to
            prune; high-error rows (&gt; 5%) signal upstream regressions or
            mis-configured callers.
          </p>
        </div>
      </header>

      {queryError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load API key usage: {queryError}
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard label="Keys (shown)" value={fmtNum(totalKeys)} />
        <SummaryCard label="Active" value={fmtNum(activeKeys)} />
        <SummaryCard label="Dormant" value={fmtNum(dormantKeys)} tone={dormantKeys > 0 ? 'warn' : 'ok'} />
        <SummaryCard label="High error" value={fmtNum(highErrorKeys)} tone={highErrorKeys > 0 ? 'bad' : 'ok'} />
        <SummaryCard label="Requests (30d)" value={fmtNum(totalRequests)} />
      </section>

      {rows.length === 0 && !queryError ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          No API keys recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">API key usage in the last 30 days</caption>
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Key</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Requests</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Errors</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Error %</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Avg ms</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Max ms</th>
                <th scope="col" className="px-4 py-3 font-medium">Last used</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <KeyRow key={r.apiKeyId} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KeyRow({ row }: { row: ApiKeyUsageRow }): React.JSX.Element {
  const isHighError = row.errorRate > ERROR_THRESHOLD;
  return (
    <tr className="border-t border-border align-top">
      <td className="px-4 py-3">
        <div className="font-medium">{row.name}</div>
        <code className="text-[11px] font-mono text-muted-foreground">{row.keyPrefix}…</code>
      </td>
      <td className="px-4 py-3">
        <span
          className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded border ${
            row.isActive
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-red-500/15 text-red-300 border-red-500/30'
          }`}
        >
          {row.isActive ? 'active' : 'revoked'}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-mono">{fmtNum(row.requestCount)}</td>
      <td className="px-4 py-3 text-right font-mono">{fmtNum(row.errorCount)}</td>
      <td className={`px-4 py-3 text-right font-mono ${isHighError ? 'text-red-300 font-semibold' : ''}`}>
        {fmtPct(row.errorRate)}
      </td>
      <td className="px-4 py-3 text-right font-mono">{row.requestCount > 0 ? row.avgLatencyMs : '—'}</td>
      <td className="px-4 py-3 text-right font-mono">{row.requestCount > 0 ? row.maxLatencyMs : '—'}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(row.lastUsedAt)}</td>
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

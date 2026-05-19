// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
/**
 * /dashboard/admin/crons — Cron run monitor (admin only).
 *
 * Server Component. Lists every scheduled job's last run with colored
 * status badge + relative age + total run count.
 *
 * Data source: `listCronRunSummaries` from `@/land/observability/cron-run-stats`.
 */

import { ServerCog } from 'lucide-react';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import {
  listCronRunSummaries,
  type CronRunSummary,
  type CronStatus,
} from '@/land/observability/cron-run-stats';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

const STATUS_BADGE: Record<CronStatus, string> = {
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  failure: 'bg-red-500/15 text-red-300 border-red-500/30',
  skipped: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

function fmtAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

export default async function CronMonitorPage({ params }: PageProps): Promise<React.JSX.Element> {
  await params;
  await requireMasterTier();

  let crons: CronRunSummary[] = [];
  let queryError: string | null = null;
  try {
    crons = await listCronRunSummaries();
  } catch (err) {
    queryError = String(err);
  }

  const failing = crons.filter((c) => c.lastStatus === 'failure').length;
  const stale = crons.filter((c) => c.ageSec > 24 * 3600).length;

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <ServerCog className="w-6 h-6 text-violet-400 mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">Cron Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Last execution per scheduled job. Stale = no run in 24h. Watch for failure-status rows.
          </p>
        </div>
      </header>

      {queryError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load cron log: {queryError}
        </div>
      )}

      <section className="grid grid-cols-3 gap-4">
        <SummaryCard label="Crons tracked" value={crons.length.toString()} />
        <SummaryCard label="Currently failing" value={failing.toString()} tone={failing > 0 ? 'bad' : 'ok'} />
        <SummaryCard label="Stale (>24h)" value={stale.toString()} tone={stale > 0 ? 'warn' : 'ok'} />
      </section>

      {crons.length === 0 && !queryError ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          No cron runs recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Scheduled cron job last-run summary</caption>
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Cron</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Last run</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Total runs</th>
                <th scope="col" className="px-4 py-3 font-medium">Last error</th>
              </tr>
            </thead>
            <tbody>
              {crons.map((c) => (
                <tr key={c.cronName} className="border-t border-border align-top">
                  <td className="px-4 py-3 font-mono text-xs">{c.cronName}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded border ${STATUS_BADGE[c.lastStatus]}`}>
                      {c.lastStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {fmtAge(c.ageSec)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{c.runCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-md truncate" title={c.lastError ?? ''}>
                    {c.lastError ?? '—'}
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

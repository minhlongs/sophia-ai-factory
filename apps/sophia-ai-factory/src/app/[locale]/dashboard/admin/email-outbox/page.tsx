/**
 * /dashboard/admin/email-outbox — Email outbox monitor (admin only).
 *
 * Server Component. Surfaces queue depth (sent/pending/failed) plus the
 * 10 most recent failures and successful sends.
 *
 * Data source: `getEmailOutboxSnapshot` from `@/land/observability/email-outbox-stats`.
 */

import { redirect } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  getEmailOutboxSnapshot,
  type OutboxRecentRow,
  type OutboxSnapshot,
  type OutboxStatus,
} from '@/land/observability/email-outbox-stats';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

const STATUS_BADGE: Record<OutboxStatus, string> = {
  sent: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  failed: 'bg-red-500/15 text-red-300 border-red-500/30',
};

function fmtAge(unixSec: number | null): string {
  if (!unixSec) return '—';
  const ageSec = Math.floor(Date.now() / 1000) - unixSec;
  if (ageSec < 60) return `${ageSec}s ago`;
  if (ageSec < 3600) return `${Math.round(ageSec / 60)}m ago`;
  if (ageSec < 86400) return `${Math.round(ageSec / 3600)}h ago`;
  return `${Math.round(ageSec / 86400)}d ago`;
}

function totalsLookup(snapshot: OutboxSnapshot, status: OutboxStatus): number {
  return snapshot.totals.find((t) => t.status === status)?.count ?? 0;
}

export default async function EmailOutboxPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') redirect(`/${locale}/dashboard`);

  let snapshot: OutboxSnapshot | null = null;
  let queryError: string | null = null;
  try {
    snapshot = await getEmailOutboxSnapshot();
  } catch (err) {
    queryError = String(err);
  }

  const sent = snapshot ? totalsLookup(snapshot, 'sent') : 0;
  const pending = snapshot ? totalsLookup(snapshot, 'pending') : 0;
  const failed = snapshot ? totalsLookup(snapshot, 'failed') : 0;

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <Inbox className="w-6 h-6 text-violet-400 mt-1 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold">Email Outbox Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Durable queue for transactional + lifecycle emails. Pending due = retries
            ready now; pending future = backed off.
          </p>
        </div>
      </header>

      {queryError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load outbox: {queryError}
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard label="Sent" value={sent} />
        <SummaryCard label="Pending" value={pending} tone={pending > 0 ? 'warn' : 'ok'} />
        <SummaryCard label="Failed" value={failed} tone={failed > 0 ? 'bad' : 'ok'} />
        <SummaryCard label="Pending due" value={snapshot?.pendingDue ?? 0} tone={(snapshot?.pendingDue ?? 0) > 0 ? 'warn' : 'ok'} />
        <SummaryCard label="Pending future" value={snapshot?.pendingFuture ?? 0} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Recent failures
        </h2>
        {snapshot && snapshot.recentFailures.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-sm">
            No recent failures. 🎉
          </div>
        ) : (
          <OutboxTable rows={snapshot?.recentFailures ?? []} showError />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Recent sends
        </h2>
        {snapshot && snapshot.recentSends.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-sm">
            No sends recorded yet.
          </div>
        ) : (
          <OutboxTable rows={snapshot?.recentSends ?? []} />
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'ok',
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'warn' | 'bad';
}): React.JSX.Element {
  const valueClass =
    tone === 'bad' ? 'text-red-300' : tone === 'warn' ? 'text-amber-300' : 'text-foreground';
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${valueClass}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function OutboxTable({
  rows,
  showError = false,
}: {
  rows: OutboxRecentRow[];
  showError?: boolean;
}): React.JSX.Element {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">When</th>
            <th scope="col" className="px-4 py-3 font-medium">Template</th>
            <th scope="col" className="px-4 py-3 font-medium">Recipient</th>
            <th scope="col" className="px-4 py-3 font-medium text-right">Attempts</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            {showError && <th scope="col" className="px-4 py-3 font-medium">Error</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {fmtAge(r.status === 'sent' ? r.sentAt : r.createdAt)}
              </td>
              <td className="px-4 py-3 font-mono text-xs">{r.template}</td>
              <td className="px-4 py-3 text-xs">{r.toEmail}</td>
              <td className="px-4 py-3 text-right font-mono">{r.attempts}</td>
              <td className="px-4 py-3">
                <span className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded border ${STATUS_BADGE[r.status]}`}>
                  {r.status}
                </span>
              </td>
              {showError && (
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-md truncate" title={r.lastError ?? ''}>
                  {r.lastError ?? '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

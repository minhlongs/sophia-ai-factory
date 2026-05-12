/**
 * /dashboard/admin/webhook-deliveries — Outbound webhook delivery monitor.
 *
 * Server Component. Surfaces endpoint health, attempt totals by status,
 * and the 10 most recent failures + 10 most recent successes.
 *
 * Data source: `getWebhookDeliverySnapshot` from
 * `@/land/observability/webhook-delivery-stats`.
 */

import { redirect } from 'next/navigation';
import { Webhook } from 'lucide-react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  getWebhookDeliverySnapshot,
  type WebhookAttemptRow,
  type WebhookAttemptStatus,
  type WebhookDeliverySnapshot,
} from '@/land/observability/webhook-delivery-stats';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

const STATUS_BADGE: Record<WebhookAttemptStatus, string> = {
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  failed: 'bg-red-500/15 text-red-300 border-red-500/30',
  dead_letter: 'bg-red-700/20 text-red-200 border-red-700/40',
};

function fmtAge(iso: string | null): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const ageSec = Math.floor((Date.now() - ts) / 1000);
  if (ageSec < 60) return `${ageSec}s ago`;
  if (ageSec < 3600) return `${Math.round(ageSec / 60)}m ago`;
  if (ageSec < 86400) return `${Math.round(ageSec / 3600)}h ago`;
  return `${Math.round(ageSec / 86400)}d ago`;
}

function attemptTotal(snapshot: WebhookDeliverySnapshot, status: WebhookAttemptStatus): number {
  return snapshot.attemptTotals.find((t) => t.status === status)?.count ?? 0;
}

export default async function WebhookMonitorPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') redirect(`/${locale}/dashboard`);

  let snapshot: WebhookDeliverySnapshot | null = null;
  let queryError: string | null = null;
  try {
    snapshot = await getWebhookDeliverySnapshot();
  } catch (err) {
    queryError = String(err);
  }

  const success = snapshot ? attemptTotal(snapshot, 'success') : 0;
  const failed = snapshot ? attemptTotal(snapshot, 'failed') : 0;
  const deadLetter = snapshot ? attemptTotal(snapshot, 'dead_letter') : 0;
  const pending = snapshot ? attemptTotal(snapshot, 'pending') : 0;

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <Webhook className="w-6 h-6 text-violet-400 mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">Webhook Deliveries</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Outbound webhooks fired to customer-registered endpoints. Watch dead-letter
            count — those rows have exceeded retry budget and need a human.
          </p>
        </div>
      </header>

      {queryError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load webhook stats: {queryError}
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard
          label="Endpoints"
          value={`${snapshot?.endpoints.activeEndpoints ?? 0} / ${snapshot?.endpoints.totalEndpoints ?? 0}`}
          hint="active / total"
        />
        <SummaryCard
          label="Unhealthy endpoints"
          value={(snapshot?.endpoints.unhealthyEndpoints ?? 0).toString()}
          hint="failure_count > 0"
          tone={(snapshot?.endpoints.unhealthyEndpoints ?? 0) > 0 ? 'warn' : 'ok'}
        />
        <SummaryCard
          label="Dead-letter attempts"
          value={deadLetter.toString()}
          hint="exceeded retry budget"
          tone={deadLetter > 0 ? 'bad' : 'ok'}
        />
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Success" value={success.toLocaleString()} />
        <SummaryCard label="Failed" value={failed.toLocaleString()} tone={failed > 0 ? 'bad' : 'ok'} />
        <SummaryCard label="Dead-letter" value={deadLetter.toLocaleString()} tone={deadLetter > 0 ? 'bad' : 'ok'} />
        <SummaryCard label="Pending" value={pending.toLocaleString()} />
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
          <AttemptTable rows={snapshot?.recentFailures ?? []} showError />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Recent successes
        </h2>
        {snapshot && snapshot.recentSuccesses.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-sm">
            No successes recorded yet.
          </div>
        ) : (
          <AttemptTable rows={snapshot?.recentSuccesses ?? []} />
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = 'ok',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'warn' | 'bad';
}): React.JSX.Element {
  const valueClass =
    tone === 'bad' ? 'text-red-300' : tone === 'warn' ? 'text-amber-300' : 'text-foreground';
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function AttemptTable({
  rows,
  showError = false,
}: {
  rows: WebhookAttemptRow[];
  showError?: boolean;
}): React.JSX.Element {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">When</th>
            <th scope="col" className="px-4 py-3 font-medium">Event</th>
            <th scope="col" className="px-4 py-3 font-medium">Endpoint</th>
            <th scope="col" className="px-4 py-3 font-medium text-right">Attempt</th>
            <th scope="col" className="px-4 py-3 font-medium text-right">HTTP</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            {showError && <th scope="col" className="px-4 py-3 font-medium">Error</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="px-4 py-3 text-xs text-muted-foreground">{fmtAge(r.createdAt)}</td>
              <td className="px-4 py-3 font-mono text-xs">{r.event}</td>
              <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground truncate max-w-[180px]" title={r.endpointId}>
                {r.endpointId}
              </td>
              <td className="px-4 py-3 text-right font-mono">{r.attemptNum}</td>
              <td className="px-4 py-3 text-right font-mono">{r.httpStatus ?? '—'}</td>
              <td className="px-4 py-3">
                <span className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded border ${STATUS_BADGE[r.status]}`}>
                  {r.status}
                </span>
              </td>
              {showError && (
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-md truncate" title={r.errorMessage ?? ''}>
                  {r.errorMessage ?? '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

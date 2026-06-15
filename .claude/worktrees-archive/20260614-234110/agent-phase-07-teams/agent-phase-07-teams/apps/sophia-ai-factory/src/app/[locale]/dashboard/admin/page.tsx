/**
 * /dashboard/admin — Admin home (compound view).
 *
 * Server Component. Pulls a snapshot from every observability primitive in
 * parallel and renders an alerts strip + KPI tiles grouped by domain.
 * Each tile links to the dedicated drill-down page.
 *
 * No new primitives — pure composition of:
 *   - listCronRunSummaries        ./crons
 *   - getEmailOutboxSnapshot      ./email-outbox
 *   - getWebhookDeliverySnapshot  ./webhook-deliveries
 *   - getStorageSnapshot          ./storage
 *   - getCostSnapshot             ./cost
 *   - getActivationFunnel         ./funnel
 */

import Link from 'next/link';
import {
  Activity, AlertTriangle, BarChart2, Coins, Database,
  Inbox, KeyRound, ServerCog, Webhook,
} from 'lucide-react';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { listCronRunSummaries } from '@/land/observability/cron-run-stats';
import { getEmailOutboxSnapshot } from '@/land/observability/email-outbox-stats';
import { getWebhookDeliverySnapshot } from '@/land/observability/webhook-delivery-stats';
import { getStorageSnapshot } from '@/land/observability/storage-usage-stats';
import { getCostSnapshot } from '@/land/observability/cost-snapshot';
import { getActivationFunnel } from '@/land/analytics/funnel-stats';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

const STALE_HOURS = 24;

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtBytes(bytes: number): string {
  const GB = 1024 ** 3;
  const MB = 1024 ** 2;
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${bytes.toLocaleString()} B`;
}

interface Alert {
  severity: 'bad' | 'warn';
  label: string;
  href: string;
}

export default async function AdminHomePage({ params }: PageProps): Promise<React.JSX.Element> {
  await params;
  await requireMasterTier();

  const now = Math.floor(Date.now() / 1000);
  const fromTs = now - 30 * 86400;

  // Each primitive may throw if its table is missing; isolate so one broken
  // panel doesn't blank the whole page.
  const [cronsR, outboxR, webhooksR, storageR, costR, funnelR] = await Promise.allSettled([
    listCronRunSummaries(),
    getEmailOutboxSnapshot(),
    getWebhookDeliverySnapshot(),
    getStorageSnapshot(5),
    getCostSnapshot(fromTs, now, 5),
    getActivationFunnel(fromTs, now),
  ]);

  const crons = cronsR.status === 'fulfilled' ? cronsR.value : [];
  const outbox = outboxR.status === 'fulfilled' ? outboxR.value : null;
  const webhooks = webhooksR.status === 'fulfilled' ? webhooksR.value : null;
  const storage = storageR.status === 'fulfilled' ? storageR.value : null;
  const cost = costR.status === 'fulfilled' ? costR.value : null;
  const funnel = funnelR.status === 'fulfilled' ? funnelR.value : null;

  // ── Derive alert strip ─────────────────────────────────────────────────
  const alerts: Alert[] = [];
  const failingCrons = crons.filter((c) => c.lastStatus === 'failure').length;
  const staleCrons = crons.filter((c) => c.ageSec > STALE_HOURS * 3600).length;
  if (failingCrons > 0) {
    alerts.push({
      severity: 'bad',
      label: `${failingCrons} cron${failingCrons === 1 ? '' : 's'} failing`,
      href: '/dashboard/admin/crons',
    });
  }
  if (staleCrons > 0) {
    alerts.push({
      severity: 'warn',
      label: `${staleCrons} cron${staleCrons === 1 ? '' : 's'} stale (>24h)`,
      href: '/dashboard/admin/crons',
    });
  }
  const failedOutbox = outbox?.totals.find((t) => t.status === 'failed')?.count ?? 0;
  if (failedOutbox > 0) {
    alerts.push({
      severity: 'bad',
      label: `${failedOutbox} email${failedOutbox === 1 ? '' : 's'} failed`,
      href: '/dashboard/admin/email-outbox',
    });
  }
  const deadLetters = webhooks?.attemptTotals.find((t) => t.status === 'dead_letter')?.count ?? 0;
  if (deadLetters > 0) {
    alerts.push({
      severity: 'bad',
      label: `${deadLetters} webhook${deadLetters === 1 ? '' : 's'} dead-lettered`,
      href: '/dashboard/admin/webhook-deliveries',
    });
  }
  const unhealthy = webhooks?.endpoints.unhealthyEndpoints ?? 0;
  if (unhealthy > 0) {
    alerts.push({
      severity: 'warn',
      label: `${unhealthy} unhealthy endpoint${unhealthy === 1 ? '' : 's'}`,
      href: '/dashboard/admin/webhook-deliveries',
    });
  }
  const staleStorage = storage?.global.staleTenantCount ?? 0;
  if (staleStorage > 0) {
    alerts.push({
      severity: 'warn',
      label: `${staleStorage} storage row${staleStorage === 1 ? '' : 's'} stale`,
      href: '/dashboard/admin/storage',
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Admin Home</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cross-domain snapshot. Click any tile to drill into the matching dashboard.
        </p>
      </header>

      {alerts.length === 0 ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          All clear. No active alerts across crons, email, webhooks, or storage.
        </div>
      ) : (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <h2 className="text-sm font-medium text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            Active alerts ({alerts.length})
          </h2>
          <ul className="flex flex-wrap gap-2">
            {alerts.map((a) => (
              <li key={`${a.label}-${a.href}`}>
                <Link
                  href={a.href}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                    a.severity === 'bad'
                      ? 'border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                  }`}
                >
                  {a.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          icon={ServerCog}
          title="Crons"
          href="/dashboard/admin/crons"
          rows={[
            ['Tracked', crons.length.toString()],
            ['Failing', failingCrons.toString(), failingCrons > 0 ? 'bad' : 'ok'],
            ['Stale (>24h)', staleCrons.toString(), staleCrons > 0 ? 'warn' : 'ok'],
          ]}
        />
        <Panel
          icon={Inbox}
          title="Email outbox"
          href="/dashboard/admin/email-outbox"
          rows={[
            ['Sent', String(outbox?.totals.find((t) => t.status === 'sent')?.count ?? 0)],
            ['Pending', String(outbox?.totals.find((t) => t.status === 'pending')?.count ?? 0)],
            ['Failed', String(failedOutbox), failedOutbox > 0 ? 'bad' : 'ok'],
          ]}
        />
        <Panel
          icon={Webhook}
          title="Webhook deliveries"
          href="/dashboard/admin/webhook-deliveries"
          rows={[
            ['Active endpoints', `${webhooks?.endpoints.activeEndpoints ?? 0} / ${webhooks?.endpoints.totalEndpoints ?? 0}`],
            ['Dead-letter', String(deadLetters), deadLetters > 0 ? 'bad' : 'ok'],
            ['Unhealthy', String(unhealthy), unhealthy > 0 ? 'warn' : 'ok'],
          ]}
        />
        <Panel
          icon={Database}
          title="R2 storage"
          href="/dashboard/admin/storage"
          rows={[
            ['Tenants', (storage?.global.tenantCount ?? 0).toString()],
            ['Total', fmtBytes(storage?.global.totalBytes ?? 0)],
            ['Stale', String(staleStorage), staleStorage > 0 ? 'warn' : 'ok'],
          ]}
        />
        <Panel
          icon={Coins}
          title="Provider cost (30d)"
          href="/dashboard/admin/cost"
          rows={[
            ['Spent', fmtUsd(cost?.global.totalCostUsd ?? 0)],
            ['Monthly projection', fmtUsd(cost?.monthlyProjectionUsd ?? 0)],
            ['Jobs billed', (cost?.global.jobCount ?? 0).toString()],
          ]}
        />
        <Panel
          icon={BarChart2}
          title="Activation funnel (30d)"
          href="/dashboard/admin/funnel"
          rows={[
            ['Signups', (funnel?.signups ?? 0).toString()],
            ['First video', `${funnel?.firstVideo ?? 0} (${pctRow(funnel?.conversions.loginToVideo ?? 0)})`],
            ['First conversion', `${funnel?.firstConversion ?? 0} (${pctRow(funnel?.conversions.videoToConversion ?? 0)})`],
          ]}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Quick tools
        </h2>
        <div className="flex flex-wrap gap-2">
          <QuickLink icon={Activity} href="/dashboard/admin/tenant-lookup" label="Tenant lookup" />
          <QuickLink icon={KeyRound} href="/dashboard/admin/api-key-usage" label="API key usage" />
          <QuickLink icon={Coins} href="/dashboard/admin/affiliate-leaderboard" label="Affiliate leaderboard" />
          <QuickLink icon={ServerCog} href="/dashboard/admin/audit-log" label="Audit log" />
        </div>
      </section>
    </div>
  );
}

function pctRow(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

type PanelRow = [label: string, value: string, tone?: 'ok' | 'warn' | 'bad'];

function Panel({
  icon: Icon,
  title,
  href,
  rows,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  href: string;
  rows: PanelRow[];
}): React.JSX.Element {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-border bg-card p-5 hover:border-foreground/40 transition"
    >
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary-400" aria-hidden="true" />
          <h2 className="font-semibold">{title}</h2>
        </div>
        <span className="text-[11px] text-muted-foreground">drill in →</span>
      </header>
      <dl className="space-y-1.5">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="flex items-baseline justify-between text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd
              className={`font-mono font-medium ${
                tone === 'bad'
                  ? 'text-red-300'
                  : tone === 'warn'
                  ? 'text-amber-300'
                  : 'text-foreground'
              }`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}

function QuickLink({
  icon: Icon,
  href,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  label: string;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:border-foreground/40 transition"
    >
      <Icon className="w-4 h-4 text-primary-400" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

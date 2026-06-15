/**
 * /dashboard/admin — Admin home (compound view).
 *
 * Server Component: pulls snapshots from observability primitives
 * and renders alerts strip + KPI tiles grouped by domain.
 * Each tile links to the dedicated drill-down page.
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { listCronRunSummaries } from '@/land/observability/cron-run-stats';
import { getEmailOutboxSnapshot } from '@/land/observability/email-outbox-stats';
import { getWebhookDeliverySnapshot } from '@/land/observability/webhook-delivery-stats';
import { getStorageSnapshot } from '@/land/observability/storage-usage-stats';
import { getCostSnapshot } from '@/land/observability/cost-snapshot';
import { getActivationFunnel } from '@/land/analytics/funnel-stats';
import AdminAlertsStrip from '@/components/admin/AdminAlertsStrip';
import AdminStatsCard from '@/components/admin/AdminStatsCard';
import AdminQuickTools from '@/components/admin/AdminQuickTools';
import { AlertTriangle, Activity, BarChart2, Coins, Database, Inbox, KeyRound, ServerCog, Webhook } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Alert {
  severity: 'bad' | 'warn';
  label: string;
  href: string;
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

function pctRow(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export default async function AdminHomePage() {
  await requireMasterTier();

  const now = Math.floor(Date.now() / 1000);
  const fromTs = now - 30 * 86400;

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

  // Derive alert strip
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

  const statsCards = [
    {
      icon: ServerCog,
      title: 'Crons',
      href: '/dashboard/admin/crons',
      rows: [
        ['Tracked', crons.length.toString()],
        ['Failing', failingCrons.toString(), failingCrons > 0 ? 'bad' : 'ok'],
        ['Stale (>24h)', staleCrons.toString(), staleCrons > 0 ? 'warn' : 'ok'],
      ],
    },
    {
      icon: Inbox,
      title: 'Email outbox',
      href: '/dashboard/admin/email-outbox',
      rows: [
        ['Sent', String(outbox?.totals.find((t) => t.status === 'sent')?.count ?? 0)],
        ['Pending', String(outbox?.totals.find((t) => t.status === 'pending')?.count ?? 0)],
        ['Failed', String(failedOutbox), failedOutbox > 0 ? 'bad' : 'ok'],
      ],
    },
    {
      icon: Webhook,
      title: 'Webhook deliveries',
      href: '/dashboard/admin/webhook-deliveries',
      rows: [
        ['Active endpoints', `${webhooks?.endpoints.activeEndpoints ?? 0} / ${webhooks?.endpoints.totalEndpoints ?? 0}`],
        ['Dead-letter', String(deadLetters), deadLetters > 0 ? 'bad' : 'ok'],
        ['Unhealthy', String(unhealthy), unhealthy > 0 ? 'warn' : 'ok'],
      ],
    },
    {
      icon: Database,
      title: 'R2 storage',
      href: '/dashboard/admin/storage',
      rows: [
        ['Tenants', (storage?.global.tenantCount ?? 0).toString()],
        ['Total', fmtBytes(storage?.global.totalBytes ?? 0)],
        ['Stale', String(staleStorage), staleStorage > 0 ? 'warn' : 'ok'],
      ],
    },
    {
      icon: Coins,
      title: 'Provider cost (30d)',
      href: '/dashboard/admin/cost',
      rows: [
        ['Spent', fmtUsd(cost?.global.totalCostUsd ?? 0)],
        ['Monthly projection', fmtUsd(cost?.monthlyProjectionUsd ?? 0)],
        ['Jobs billed', (cost?.global.jobCount ?? 0).toString()],
      ],
    },
    {
      icon: BarChart2,
      title: 'Activation funnel (30d)',
      href: '/dashboard/admin/funnel',
      rows: [
        ['Signups', (funnel?.signups ?? 0).toString()],
        ['First video', `${funnel?.firstVideo ?? 0} (${pctRow(funnel?.conversions.loginToVideo ?? 0)})`],
        ['First conversion', `${funnel?.firstConversion ?? 0} (${pctRow(funnel?.conversions.videoToConversion ?? 0)})`],
      ],
    },
  ];

  const quickLinks = [
    { icon: Activity, href: '/dashboard/admin/tenant-lookup', label: 'Tenant lookup' },
    { icon: KeyRound, href: '/dashboard/admin/api-key-usage', label: 'API key usage' },
    { icon: Coins, href: '/dashboard/admin/affiliate-leaderboard', label: 'Affiliate leaderboard' },
    { icon: ServerCog, href: '/dashboard/admin/audit-log', label: 'Audit log' },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Admin Home</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cross-domain snapshot. Click any tile to drill into the matching dashboard.
        </p>
      </header>

      <AdminAlertsStrip alerts={alerts} />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {statsCards.map((card) => (
          <AdminStatsCard
            key={card.title}
            icon={card.icon}
            title={card.title}
            href={card.href}
            rows={card.rows}
          />
        ))}
      </section>

      <AdminQuickTools links={quickLinks} />
    </div>
  );
}

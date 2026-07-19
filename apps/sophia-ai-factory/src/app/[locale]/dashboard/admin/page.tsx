/**
 * /dashboard/admin — Admin home (compound view).
 *
 * Server Component: pulls snapshots from observability primitives
 * and renders Stitch AdminPageContent dashboard with derived KPI metrics.
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { listCronRunSummaries } from '@/land/observability/cron-run-stats';
import { getEmailOutboxSnapshot } from '@/land/observability/email-outbox-stats';
import { getWebhookDeliverySnapshot } from '@/land/observability/webhook-delivery-stats';
import { getStorageSnapshot } from '@/land/observability/storage-usage-stats';
import { getCostSnapshot } from '@/land/observability/cost-snapshot';
import { getActivationFunnel } from '@/land/analytics/funnel-stats';
import { AdminPageContent } from '@/components/stitch/screens/admin';
import type { KpiData, SystemService, DeployStatus } from '@/components/stitch/screens/admin';

export const dynamic = 'force-dynamic';

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

  // ── Derive alert/issue aggregates from observability data ──
  const failingCrons = crons.filter((c) => c.lastStatus === 'failure').length;
  const staleCrons = crons.filter((c) => c.ageSec > STALE_HOURS * 3600).length;
  const failedOutbox = outbox?.totals.find((t) => t.status === 'failed')?.count ?? 0;
  const deadLetters = webhooks?.attemptTotals.find((t) => t.status === 'dead_letter')?.count ?? 0;
  const unhealthyWebhooks = webhooks?.endpoints.unhealthyEndpoints ?? 0;
  const staleStorage = storage?.global.staleTenantCount ?? 0;

  const totalIssues =
    (failingCrons > 0 ? 1 : 0) +
    (staleCrons > 0 ? 1 : 0) +
    (failedOutbox > 0 ? 1 : 0) +
    deadLetters +
    unhealthyWebhooks +
    staleStorage;

  // ── KPI metric cards (6-up grid) ──────────────────────────
  const kpiMetrics: KpiData[] = [
    {
      id: 'crons',
      value: crons.length.toString(),
      trend: failingCrons > 0 ? `${failingCrons} failing` : undefined,
      trendDirection: failingCrons > 0 ? 'down' : 'up',
      trendLabel: failingCrons === 0 && staleCrons === 0 ? 'Healthy' : undefined,
    },
    {
      id: 'emails',
      value: (outbox?.totals.find((t) => t.status === 'sent')?.count ?? 0).toString(),
      trend: failedOutbox > 0 ? `${failedOutbox} failed` : undefined,
      trendDirection: failedOutbox > 0 ? 'down' : 'up',
      trendLabel: failedOutbox === 0 ? 'OK' : undefined,
    },
    {
      id: 'webhooks',
      value: `${webhooks?.endpoints.activeEndpoints ?? 0} / ${webhooks?.endpoints.totalEndpoints ?? 0} active`,
      trend: deadLetters > 0 ? `${deadLetters} dead-letter` : undefined,
      trendDirection: deadLetters > 0 ? 'down' : 'up',
      trendLabel: deadLetters === 0 && unhealthyWebhooks === 0 ? 'All OK' : undefined,
    },
    {
      id: 'storage',
      value: fmtBytes(storage?.global.totalBytes ?? 0),
      trend: `${storage?.global.tenantCount ?? 0} tenants`,
      trendDirection: 'up',
      trendLabel: staleStorage > 0 ? `${staleStorage} stale` : undefined,
    },
    {
      id: 'cost',
      value: fmtUsd(cost?.global.totalCostUsd ?? 0),
      trend: `${fmtUsd(cost?.monthlyProjectionUsd ?? 0)} projected`,
      trendDirection: 'up',
    },
    {
      id: 'signups',
      value: (funnel?.signups ?? 0).toString(),
      trend: `${pctRow(funnel?.conversions.loginToVideo ?? 0)} to video`,
      trendDirection: funnel && funnel.conversions.loginToVideo > 0.5 ? 'up' : 'down',
    },
  ];

  // ── System services list (right column) ───────────────────
  const services: SystemService[] = [
    { id: 'd1', name: 'D1 Database', status: 'healthy', latency: '—' },
    {
      id: 'crons',
      name: 'Scheduled Crons',
      status: failingCrons > 0 ? 'warning' : 'healthy',
      latency: failingCrons > 0 ? `${failingCrons} failing` : 'All OK',
    },
    {
      id: 'email',
      name: 'Email Outbox',
      status: failedOutbox > 0 ? 'warning' : 'healthy',
      latency: failedOutbox > 0 ? `${failedOutbox} failed` : 'All sent',
    },
    {
      id: 'webhooks',
      name: 'Webhook Delivery',
      status: deadLetters > 0 || unhealthyWebhooks > 0 ? 'warning' : 'healthy',
      latency: deadLetters > 0 ? `${deadLetters} dead-letter` : 'OK',
    },
    {
      id: 'r2',
      name: 'R2 Storage',
      status: staleStorage > 0 ? 'warning' : 'healthy',
      latency: staleStorage > 0 ? `${staleStorage} stale` : 'Current',
    },
    {
      id: 'cost',
      name: 'Provider Cost',
      status: 'healthy',
      latency: `${fmtUsd(cost?.global.totalCostUsd ?? 0)} (${cost?.global.jobCount ?? 0} jobs)`,
    },
  ];

  // ── Deploy status footer ──────────────────────────────────
  const deployInfo: DeployStatus = {
    sha: process.env.CF_PAGES_COMMIT_SHA
      ? `${process.env.CF_PAGES_COMMIT_SHA.slice(0, 8)}`
      : process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
        ? `${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.slice(0, 8)}`
        : 'local',
    env: process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
    ago: new Date().toLocaleTimeString(),
  };

  return (
    <AdminPageContent
      kpiMetrics={kpiMetrics}
      services={services}
      deployInfo={deployInfo}
      badgeLabel={totalIssues > 0 ? `${totalIssues} issue${totalIssues === 1 ? '' : 's'}` : undefined}
    />
  );
}

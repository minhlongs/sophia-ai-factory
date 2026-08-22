/**
 * YouTube Analytics — performance insights (24h / 7d / 30d metrics).
 * Server Component: aggregates snapshots by measurement window.
 */

import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listSnapshots, parseJson } from '../data';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('youtube');
  return {
    title: t('navAnalytics'),
    description: t('performance'),
  };
}

interface MetricSummary {
  count: number;
  totalViews: number;
  totalImpressions: number;
  avgCTR: number;
  avgRetention: number;
  avgEngagement: number;
}

function emptySummary(): MetricSummary {
  return {
    count: 0,
    totalViews: 0,
    totalImpressions: 0,
    avgCTR: 0,
    avgRetention: 0,
    avgEngagement: 0,
  };
}

function summarize(
  snapshots: Array<{ metrics: string }>,
): MetricSummary {
  const summary = emptySummary();
  for (const snap of snapshots) {
    const metrics = parseJson(snap.metrics, {} as Record<string, number>);
    summary.count += 1;
    summary.totalViews += Number(metrics.views) || 0;
    summary.totalImpressions += Number(metrics.impressions) || 0;
    summary.avgCTR += Number(metrics.ctr) || 0;
    summary.avgRetention += Number(metrics.retention) || 0;
    summary.avgEngagement += Number(metrics.engagementRate) || 0;
  }
  if (summary.count > 0) {
    summary.avgCTR = summary.avgCTR / summary.count;
    summary.avgRetention = summary.avgRetention / summary.count;
    summary.avgEngagement = summary.avgEngagement / summary.count;
  }
  return summary;
}

interface MetricCardProps {
  label: string;
  value: string;
  helper?: string;
}

function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      {helper && <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>}
    </div>
  );
}

export default async function YoutubeAnalyticsPage() {
  const t = await getTranslations('youtube');
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-rose-600">{t('loading')}</p>
      </div>
    );
  }

  const snapshots = await listSnapshots(user.id, 200);

  const windows: Array<{ label: string; key: string }> = [
    { label: t('window24h'), key: '24h' },
    { label: t('window7d'), key: '7d' },
    { label: t('window30d'), key: '30d' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(240,12%,12%)]">{t('performance')}</h1>
        <p className="mt-1 text-sm text-[hsl(240,12%,45%)]">{t('overviewDescription')}</p>
      </header>

      {snapshots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">{t('noAnalytics')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {windows.map((window) => {
            const windowSnapshots = snapshots.filter(
              (s) => s.measurementWindow === window.key,
            );
            const summary = summarize(windowSnapshots);

            return (
              <section key={window.key} className="rounded-lg border border-border bg-background p-4">
                <h2 className="text-sm font-semibold text-foreground">{window.label}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {summary.count} snapshot{summary.count === 1 ? '' : 's'}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <MetricCard label={t('views')} value={summary.totalViews.toLocaleString()} />
                  <MetricCard label={t('impressions')} value={summary.totalImpressions.toLocaleString()} />
                  <MetricCard label={t('ctr')} value={`${summary.avgCTR.toFixed(2)}%`} />
                  <MetricCard label={t('retention')} value={`${summary.avgRetention.toFixed(1)}%`} />
                  <MetricCard label={t('watchMinutes')} value={summary.totalViews.toLocaleString()} />
                  <MetricCard label={t('engagement')} value={`${summary.avgEngagement.toFixed(2)}%`} />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
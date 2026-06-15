'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import {
  getAnalyticsDashboardAction,
  triggerAnalyticsSyncAction,
} from '@/app/actions/analytics-action';
import { VideoPerformanceCard } from './video-performance-card';

type DateRangeKey = '7d' | '30d' | '90d';

const DATE_RANGES: Record<DateRangeKey, () => { start: string; end: string }> = {
  '7d': () => {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 86400000);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  },
  '30d': () => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 86400000);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  },
  '90d': () => {
    const end = new Date();
    const start = new Date(end.getTime() - 90 * 86400000);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  },
};

export function AnalyticsDashboard() {
  const t = useTranslations('analytics');
  const [range, setRange] = useState<DateRangeKey>('30d');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<{
    totalViews: number;
    totalWatchTimeSec: number;
    avgCtr: number;
    avgCompletionRate: number;
  } | null>(null);
  const [topVideos, setTopVideos] = useState<Array<{
    videoId: string;
    platformVideoId: string;
    platform: string;
    total: number;
  }>>([]);

  useEffect(() => {
    loadDashboard();
  }, [range]);

  async function loadDashboard() {
    setLoading(true);
    const dateRange = DATE_RANGES[range]();
    const res = await getAnalyticsDashboardAction(dateRange);
    if (res.success) {
      setSummary({
        totalViews: res.data.summary.totalViews,
        totalWatchTimeSec: res.data.summary.totalWatchTimeSec,
        avgCtr: res.data.summary.avgCtr,
        avgCompletionRate: res.data.summary.avgCompletionRate,
      });
      setTopVideos(res.data.topVideos);
    }
    setLoading(false);
  }

  async function handleSync() {
    setSyncing(true);
    await triggerAnalyticsSyncAction();
    setSyncing(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['7d', '30d', '90d'] as const).map((r) => (
            <Button
              key={r}
              variant={range === r ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRange(r)}
              className="text-xs"
            >
              {t(`last${r === '7d' ? '7days' : r === '30d' ? '30days' : '90days'}`)}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          <span className="ml-1 text-xs">{t('syncNow')}</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label={t('totalViews')} value={summary.totalViews.toLocaleString()} />
            <MetricCard label={t('totalWatchTime')} value={`${Math.round(summary.totalWatchTimeSec / 3600)}h`} />
            <MetricCard label={t('avgCTR')} value={`${(summary.avgCtr * 100).toFixed(1)}%`} />
            <MetricCard label={t('avgEngagement')} value={`${(summary.avgCompletionRate * 100).toFixed(1)}%`} />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">{t('topVideos')}</h3>
            {topVideos.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('noData')}</p>
            ) : (
              topVideos.map((v) => (
                <VideoPerformanceCard
                  key={v.videoId}
                  videoId={v.videoId}
                  title={`${v.platform}: ${v.platformVideoId}`}
                  views={v.total}
                  watchTimeSec={0}
                  ctr={0}
                  engagement={0}
                />
              ))
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t('noData')}</p>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 border rounded-md text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

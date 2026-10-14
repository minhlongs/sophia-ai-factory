// i18n-namespace: dashboard.analytics
'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/seed/components/ui/card';
import type { ChannelMetric, CrossPlatformAnalyticsProps, ROIMetric } from './types';
import { MetricStatCards } from './metric-stat-cards';
import { PlatformBreakdownChart } from './platform-breakdown-chart';

export function CrossPlatformView({ workspaceId }: CrossPlatformAnalyticsProps) {
  const t = useTranslations('dashboard.analytics');
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<ChannelMetric[]>([]);
  const [roi, setRoi] = useState<ROIMetric[]>([]);

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [aggRes, roiRes] = await Promise.all([
          fetch(`/api/performance/aggregates?workspaceId=${encodeURIComponent(workspaceId)}`),
          fetch(`/api/roi?workspaceId=${encodeURIComponent(workspaceId)}`),
        ]);
        if (!aggRes.ok || !roiRes.ok) throw new Error('fetch failed');
        const aggData = (await aggRes.json()) as { channels?: Array<{ channel: string; eventCount: number; avgValueCents: number }> };
        const roiData = (await roiRes.json()) as { topChannels?: Array<{ channel: string; revenueCents: number; costCents: number }> };
        if (!cancelled) {
          setChannels((aggData.channels ?? []).map((c) => ({
            channel: c.channel,
            eventCount: c.eventCount,
            avgValueCents: Math.round(c.avgValueCents ?? 0),
          })));
          setRoi((roiData.topChannels ?? []).map((r) => ({
            channel: r.channel,
            revenueCents: r.revenueCents ?? 0,
            costCents: r.costCents ?? 0,
            roi: r.costCents ? Math.round(((r.revenueCents ?? 0) - r.costCents) / r.costCents * 100) : 0,
          })));
        }
      } catch {
        if (!cancelled) {
          setChannels([]);
          setRoi([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">{t('loading')}</div>;
  }

  if (!workspaceId) {
    return (
      <div className="p-8 text-center text-muted-foreground border border-dashed border-border/50 rounded-lg">
        {t('no_workspace') ?? 'No workspace assigned'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MetricStatCards channels={channels} roi={roi} />
      <PlatformBreakdownChart channels={channels} roi={roi} />
      {channels.length === 0 && roi.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('no_data') ?? 'No distribution data yet. Start publishing to see cross-platform analytics.'}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

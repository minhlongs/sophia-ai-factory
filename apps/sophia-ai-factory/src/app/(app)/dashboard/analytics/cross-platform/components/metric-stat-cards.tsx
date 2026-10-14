// i18n-namespace: dashboard.analytics
'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import type { ChannelMetric, ROIMetric } from './types';

interface MetricStatCardsProps {
  channels: ChannelMetric[];
  roi: ROIMetric[];
}

export function MetricStatCards({ channels, roi }: MetricStatCardsProps) {
  const t = useTranslations('dashboard.analytics');

  const totalEvents = channels.reduce((s, c) => s + c.eventCount, 0).toLocaleString();
  const totalChannels = channels.length;
  const avgRoi = roi.length ? `${Math.round(roi.reduce((s, r) => s + r.roi, 0) / roi.length)}%` : '—';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('total_events')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{totalEvents}</div>
          <p className="text-xs text-muted-foreground mt-1">{t('last_24h')}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('total_channels')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{totalChannels}</div>
          <p className="text-xs text-muted-foreground mt-1">{t('active')}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('avg_roi')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{avgRoi}</div>
          <p className="text-xs text-muted-foreground mt-1">{t('across_channels')}</p>
        </CardContent>
      </Card>
    </div>
  );
}

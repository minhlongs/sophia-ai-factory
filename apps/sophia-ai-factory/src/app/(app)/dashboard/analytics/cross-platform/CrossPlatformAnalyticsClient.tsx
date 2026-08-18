'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';

const COLORS = ['#f59e0b', '#6366f1', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

interface ChannelMetric {
  channel: string;
  eventCount: number;
  avgValueCents: number;
}

interface ROIMetric {
  channel: string;
  revenueCents: number;
  costCents: number;
  roi: number;
}

export function CrossPlatformAnalyticsClient({ workspaceId }: { workspaceId: string }) {
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
          setChannels((aggData.channels ?? []).map((c: { channel: string; eventCount: number; avgValueCents: number }) => ({
            channel: c.channel,
            eventCount: c.eventCount,
            avgValueCents: Math.round(c.avgValueCents ?? 0),
          })));
          setRoi((roiData.topChannels ?? []).map((r: { channel: string; revenueCents: number; costCents: number }) => ({
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

  const pieData = useMemo(
    () => channels.map((c) => ({ name: c.channel, value: c.eventCount })),
    [channels],
  );

  const roiBarData = useMemo(
    () =>
      roi.map((r) => ({
        name: r.channel,
        revenue: Math.round(r.revenueCents / 100),
        cost: Math.round(r.costCents / 100),
        roi: r.roi,
      })),
    [roi],
  );

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {t('loading')}
      </div>
    );
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('total_events')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{channels.reduce((s, c) => s + c.eventCount, 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('last_24h')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('total_channels')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{channels.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('active')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('avg_roi')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {roi.length ? `${Math.round(roi.reduce((s, r) => s + r.roi, 0) / roi.length)}%` : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('across_channels')}</p>
          </CardContent>
        </Card>
      </div>

      {channels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('event_distribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={120}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ percent }: { percent?: number }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {roi.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('roi_by_channel')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roiBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                  <YAxis stroke="var(--muted-foreground)" />
                  <Tooltip
                    formatter={(value: unknown) => [
                      `$${Number(value ?? 0)}`,
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

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
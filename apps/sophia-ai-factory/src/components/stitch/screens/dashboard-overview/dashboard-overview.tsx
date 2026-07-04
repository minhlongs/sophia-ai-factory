'use client';

import React from 'react';
import {
  TrendingUp,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Film,
  Megaphone,
  MonitorPlay,
  Sparkles,
  Clapperboard,
  PlusCircle,
  BarChart,
  FileText,
  UserPlus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';
import { Card, CardHeader, CardContent } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import { Progress } from '@/seed/components/ui/progress';

/* ───────────────────────────────────────────────────────────────
 * Types
 * ─────────────────────────────────────────────────────────────── */

interface KpiMetric {
  id: string;
  value: string;
  trend?: string;
  trendDirection?: 'up' | 'down';
  sparkline?: boolean;
  progressValue?: number;
  progressMax?: number;
}

interface CampaignRow {
  id: string;
  name: string;
  icon: string;
  status: 'live' | 'paused' | 'draft';
  views: string;
  revenue: string;
  lastUpdated: string;
}

export interface DashboardOverviewProps {
  kpiMetrics?: KpiMetric[];
  campaigns?: CampaignRow[];
}

const DEFAULT_METRICS: KpiMetric[] = [
  { id: 'activeCampaigns', value: '24', trend: '+3 this week', trendDirection: 'up' },
  { id: 'totalViews', value: '847K', sparkline: true },
  { id: 'revenueMtd', value: '$12,847', trend: '+12% vs last month', trendDirection: 'up' },
  { id: 'creditsUsed', value: '3,421', progressValue: 34, progressMax: 100 },
];

const DEFAULT_CAMPAIGNS: CampaignRow[] = [
  { id: 'c1', name: "Winter Collection '24", icon: 'movie', status: 'live', views: '128.4K', revenue: '$2,410', lastUpdated: '2h ago' },
  { id: 'c2', name: 'AI Studio Explainer', icon: 'campaign', status: 'paused', views: '45.2K', revenue: '$890', lastUpdated: '5h ago' },
  { id: 'c3', name: 'Product Demo v2', icon: 'smart_display', status: 'draft', views: '—', revenue: '—', lastUpdated: 'Yesterday' },
  { id: 'c4', name: 'Viral Teaser #4', icon: 'auto_fix_high', status: 'live', views: '312.9K', revenue: '$5,200', lastUpdated: '2d ago' },
  { id: 'c5', name: 'Brand Anthem', icon: 'video_library', status: 'live', views: '89.1K', revenue: '$1,450', lastUpdated: '3d ago' },
];

/* ───────────────────────────────────────────────────────────────
 * Icon mapping
 * ─────────────────────────────────────────────────────────────── */

const campaignIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  movie: Film,
  campaign: Megaphone,
  smart_display: MonitorPlay,
  auto_fix_high: Sparkles,
  video_library: Clapperboard,
};

/* ───────────────────────────────────────────────────────────────
 * Status badge colors
 * ─────────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, string> = {
  live: 'bg-emerald-500/10 text-emerald-400',
  paused: 'bg-amber-500/10 text-amber-400',
  draft: 'bg-zinc-500/10 text-zinc-400',
};

/* ───────────────────────────────────────────────────────────────
 * Primary chart gradient ID
 * ─────────────────────────────────────────────────────────────── */

const CHART_GRADIENT_ID = 'indigoChartGradient';
const CHART_LABELS = ['Sept 01', 'Sept 08', 'Sept 15', 'Sept 22', 'Sept 29'];

/* ════════════════════════════════════════════════════════════════════
 * DashboardOverview
 * ════════════════════════════════════════════════════════════════════ */

export default function DashboardOverview({
  kpiMetrics,
  campaigns,
}: DashboardOverviewProps) {
  const t = useTranslations('stitch.dashboardOverview');

  const metrics = kpiMetrics ?? DEFAULT_METRICS;
  const rows = campaigns ?? DEFAULT_CAMPAIGNS;

  return (
    <main
      className="flex-1 overflow-y-auto p-8"
      aria-label={t('aria.mainContent')}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-white tracking-tight">
            {t('title')}
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div
          className="flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-lg border border-outline-variant/10 cursor-pointer hover:bg-surface-container-highest transition-colors"
          role="button"
          tabIndex={0}
          aria-label={t('periodSelector.ariaLabel')}
        >
          <CalendarDays className="w-4 h-4 text-on-surface-variant" aria-hidden="true" />
          <span className="text-sm font-medium">{t('periodSelector.label')}</span>
          <ChevronDown className="w-4 h-4 text-on-surface-variant" aria-hidden="true" />
        </div>
      </div>

      {/* ── KPI Row ───────────────────────────────────────────── */}
      <section aria-label={t('aria.kpiSection')} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((metric) => (
          <Card
            key={metric.id}
            className="bg-[#18181B] border-zinc-800 p-6"
          >
            <CardHeader className="p-0">
              <p className="text-on-surface-variant text-sm font-medium uppercase tracking-wider">
                {t(`kpi.${metric.id}.label`)}
              </p>
              <h3 className="text-[32px] font-bold text-white mt-1">
                {metric.id === 'creditsUsed' && metric.progressValue != null
                  ? t('kpi.creditsUsed.value', {
                      used: metric.value,
                      total: metric.progressMax?.toLocaleString() ?? '10,000',
                    })
                  : metric.value}
              </h3>
            </CardHeader>
            <CardContent className="p-0 mt-4">
              {metric.trend && (
                <div className="flex items-center gap-1 text-emerald-400 text-sm">
                  <TrendingUp className="w-4 h-4" aria-hidden="true" />
                  <span>{metric.trend}</span>
                </div>
              )}
              {metric.sparkline && (
                <div className="h-8 mt-2" aria-hidden="true">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 20" role="img" aria-label={t('aria.sparkline')}>
                    <path
                      d="M0 15 Q 10 5, 20 12 T 40 8 T 60 14 T 80 4 T 100 10"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              )}
              {metric.id === 'creditsUsed' && metric.progressValue != null && (
                <Progress
                  value={metric.progressValue}
                  max={metric.progressMax ?? 100}
                  className="w-full h-2"
                  indicatorClassName="bg-primary"
                  aria-label={t('kpi.creditsUsed.progressLabel', {
                    used: metric.value,
                    total: metric.progressMax?.toLocaleString() ?? '10,000',
                  })}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      {/* ── Performance Chart ─────────────────────────────────── */}
      <section
        aria-label={t('aria.chartSection')}
        className="bg-surface-container border border-outline-variant/10 rounded-2xl p-8 mb-8 relative"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h3 className="text-lg font-bold text-white">
            {t('chart.title')}
          </h3>
          <div className="flex gap-4" role="group" aria-label={t('aria.chartLegend')}>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-primary" aria-hidden="true" />
              <span className="text-xs text-on-surface-variant">{t('chart.legend.views')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-secondary" aria-hidden="true" />
              <span className="text-xs text-on-surface-variant">{t('chart.legend.revenue')}</span>
            </div>
          </div>
        </div>

        <div className="relative h-[300px] w-full mt-8">
          <svg className="w-full h-full" preserveAspectRatio="none" role="img" aria-label={t('aria.chart')}>
            <defs>
              <linearGradient id={CHART_GRADIENT_ID} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Grid Lines */}
            <line stroke="#25252e" strokeWidth="1" x1="0" x2="100%" y1="20%" y2="20%" />
            <line stroke="#25252e" strokeWidth="1" x1="0" x2="100%" y1="40%" y2="40%" />
            <line stroke="#25252e" strokeWidth="1" x1="0" x2="100%" y1="60%" y2="60%" />
            <line stroke="#25252e" strokeWidth="1" x1="0" x2="100%" y1="80%" y2="80%" />
            {/* Area */}
            <path
              d="M0 250 L50 220 L150 180 L250 240 L350 100 L450 160 L550 80 L650 120 L750 60 L850 110 L950 90 L1050 50 L1200 40 L1200 300 L0 300 Z"
              fill={`url(#${CHART_GRADIENT_ID})`}
            />
            <path
              d="M0 250 L50 220 L150 180 L250 240 L350 100 L450 160 L550 80 L650 120 L750 60 L850 110 L950 90 L1050 50 L1200 40"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeLinecap="round"
              strokeWidth="3"
            />
          </svg>

          {/* Tooltip indicator */}
          <div
            className="absolute top-10 left-[60%] -translate-x-1/2 p-3 rounded-lg bg-black/60 backdrop-blur-md border border-primary/30 shadow-2xl z-10"
            role="tooltip"
            aria-label={t('chart.tooltip.label')}
          >
            <p className="text-[10px] text-on-surface-variant font-bold uppercase mb-1">
              {t('chart.tooltip.date')}
            </p>
            <div className="space-y-1">
              <div className="flex justify-between gap-8">
                <span className="text-xs text-on-surface">{t('chart.tooltip.views')}</span>
                <span className="text-xs font-bold text-white">{t('chart.tooltip.viewsValue')}</span>
              </div>
              <div className="flex justify-between gap-8">
                <span className="text-xs text-on-surface">{t('chart.tooltip.revenue')}</span>
                <span className="text-xs font-bold text-white">{t('chart.tooltip.revenueValue')}</span>
              </div>
            </div>
          </div>
          <div
            className="absolute bottom-[240px] left-[60%] -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-primary ring-4 ring-primary/20"
            aria-hidden="true"
          />
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between mt-4 text-[11px] text-on-surface-variant px-1">
          {CHART_LABELS.map((label, idx) => (
            <span key={idx}>{label}</span>
          ))}
        </div>
      </section>

      {/* ── Bottom Split ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Campaigns Table */}
        <section
          aria-label={t('aria.campaignsTable')}
          className="lg:col-span-2 bg-surface-container border border-outline-variant/10 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">{t('campaigns.title')}</h3>
            <Button variant="link" className="text-primary text-sm font-medium hover:underline p-0 h-auto">
              {t('campaigns.viewAll')}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t('aria.campaignsTable')}</caption>
              <thead>
                <tr className="text-on-surface-variant border-b border-outline-variant/20">
                  <th scope="col" className="pb-4 font-semibold pr-4">
                    {t('campaigns.columns.name')}
                  </th>
                  <th scope="col" className="pb-4 font-semibold pr-4">
                    {t('campaigns.columns.status')}
                  </th>
                  <th scope="col" className="pb-4 font-semibold pr-4">
                    {t('campaigns.columns.views')}
                  </th>
                  <th scope="col" className="pb-4 font-semibold pr-4">
                    {t('campaigns.columns.revenue')}
                  </th>
                  <th scope="col" className="pb-4 font-semibold">
                    {t('campaigns.columns.lastUpdated')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {rows.map((row) => {
                  const Icon = campaignIconMap[row.icon] ?? Film;
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-surface-container-high transition-colors"
                    >
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
                            <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
                          </div>
                          <span className="font-medium text-white">{row.name}</span>
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <span
                          className={cn(
                            'px-2 py-1 rounded-full text-[10px] font-bold uppercase',
                            STATUS_STYLES[row.status]
                          )}
                        >
                          {t(`campaigns.status.${row.status}`)}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-on-surface">{row.views}</td>
                      <td className="py-4 pr-4 text-on-surface">{row.revenue}</td>
                      <td className="py-4 text-on-surface-variant">{row.lastUpdated}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Quick Actions */}
        <section aria-label={t('aria.quickActions')} className="space-y-4">
          <h3 className="text-lg font-bold text-white mb-4 px-1">
            {t('quickActions.title')}
          </h3>

          <button
            className="w-full flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/20 transition-all group text-left"
            aria-label={t('quickActions.createCampaign')}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <PlusCircle className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <div>
                <p className="text-white font-bold">{t('quickActions.createCampaign')}</p>
                <p className="text-xs text-primary/80">{t('quickActions.createCampaignDesc')}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </button>

          <button
            className="w-full flex items-center justify-between p-4 bg-surface-container border border-outline-variant/10 rounded-xl hover:bg-surface-container-high transition-all group text-left"
            aria-label={t('quickActions.viewAnalytics')}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
                <BarChart className="w-5 h-5 text-on-surface-variant" aria-hidden="true" />
              </div>
              <div>
                <p className="text-white font-bold">{t('quickActions.viewAnalytics')}</p>
                <p className="text-xs text-on-surface-variant">{t('quickActions.viewAnalyticsDesc')}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-on-surface-variant group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </button>

          <button
            className="w-full flex items-center justify-between p-4 bg-surface-container border border-outline-variant/10 rounded-xl hover:bg-surface-container-high transition-all group text-left"
            aria-label={t('quickActions.generateReport')}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
                <FileText className="w-5 h-5 text-on-surface-variant" aria-hidden="true" />
              </div>
              <div>
                <p className="text-white font-bold">{t('quickActions.generateReport')}</p>
                <p className="text-xs text-on-surface-variant">{t('quickActions.generateReportDesc')}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-on-surface-variant group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </button>

          <button
            className="w-full flex items-center justify-between p-4 bg-surface-container border border-outline-variant/10 rounded-xl hover:bg-surface-container-high transition-all group text-left"
            aria-label={t('quickActions.inviteTeam')}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-on-surface-variant" aria-hidden="true" />
              </div>
              <div>
                <p className="text-white font-bold">{t('quickActions.inviteTeam')}</p>
                <p className="text-xs text-on-surface-variant">{t('quickActions.inviteTeamDesc')}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-on-surface-variant group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </button>

          {/* Storage Usage */}
          <div className="mt-8 p-6 bg-surface-container-low border border-outline-variant/5 rounded-2xl">
            <h4 className="text-xs font-black text-on-surface-variant uppercase tracking-widest mb-4">
              {t('storage.title')}
            </h4>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">{t('storage.used', { gb: '82.4' })}</span>
              <span className="text-xs text-on-surface-variant">{t('storage.percent', { pct: '82' })}</span>
            </div>
            <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: '82%' }}
                role="progressbar"
                aria-valuenow={82}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('storage.progressLabel', { pct: '82' })}
              />
            </div>
            <p className="text-[10px] text-on-surface-variant mt-3 leading-relaxed">
              {t('storage.upgradeHint')}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

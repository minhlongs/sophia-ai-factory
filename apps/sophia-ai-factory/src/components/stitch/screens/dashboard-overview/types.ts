import React from 'react';
import {
  Film,
  Megaphone,
  MonitorPlay,
  Sparkles,
  Clapperboard,
} from 'lucide-react';

export interface KpiMetric {
  id: string;
  value: string;
  trend?: string;
  trendDirection?: 'up' | 'down';
  sparkline?: boolean;
  progressValue?: number;
  progressMax?: number;
}

export interface CampaignRow {
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

export const DEFAULT_METRICS: KpiMetric[] = [
  { id: 'activeCampaigns', value: '24', trend: '+3 this week', trendDirection: 'up' },
  { id: 'totalViews', value: '847K', sparkline: true },
  { id: 'revenueMtd', value: '$12,847', trend: '+12% vs last month', trendDirection: 'up' },
  { id: 'creditsUsed', value: '3,421', progressValue: 34, progressMax: 100 },
];

export const DEFAULT_CAMPAIGNS: CampaignRow[] = [
  { id: 'c1', name: "Winter Collection '24", icon: 'movie', status: 'live', views: '128.4K', revenue: '$2,410', lastUpdated: '2h ago' },
  { id: 'c2', name: 'AI Studio Explainer', icon: 'campaign', status: 'paused', views: '45.2K', revenue: '$890', lastUpdated: '5h ago' },
  { id: 'c3', name: 'Product Demo v2', icon: 'smart_display', status: 'draft', views: '—', revenue: '—', lastUpdated: 'Yesterday' },
  { id: 'c4', name: 'Viral Teaser #4', icon: 'auto_fix_high', status: 'live', views: '312.9K', revenue: '$5,200', lastUpdated: '2d ago' },
  { id: 'c5', name: 'Brand Anthem', icon: 'video_library', status: 'live', views: '89.1K', revenue: '$1,450', lastUpdated: '3d ago' },
];

export const CAMPAIGN_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  movie: Film,
  campaign: Megaphone,
  smart_display: MonitorPlay,
  auto_fix_high: Sparkles,
  video_library: Clapperboard,
};

export const STATUS_STYLES: Record<string, string> = {
  live: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
  paused: 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20',
  draft: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border border-zinc-500/20',
};

export const CHART_GRADIENT_ID = 'indigoChartGradient';
export const CHART_LABEL_COUNT = 5;

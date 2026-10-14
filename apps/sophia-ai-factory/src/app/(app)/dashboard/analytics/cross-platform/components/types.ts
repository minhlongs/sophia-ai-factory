// i18n-namespace: dashboard.analytics

export const COLORS = ['#f59e0b', '#6366f1', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

export interface ChannelMetric {
  channel: string;
  eventCount: number;
  avgValueCents: number;
}

export interface ROIMetric {
  channel: string;
  revenueCents: number;
  costCents: number;
  roi: number;
}

export interface CrossPlatformAnalyticsProps {
  workspaceId: string;
}

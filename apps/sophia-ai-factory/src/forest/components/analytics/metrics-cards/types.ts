import React from 'react';

export interface UsageMetricsData {
  requests: number;
  tokens: number;
  credits: number;
  responseTime: number;
  errorRate: number;
  cost?: number;
  requestsTrend?: number;
  tokensTrend?: number;
  creditsTrend?: number;
  // Sparkline data arrays
  requestsSparkline?: number[];
  tokensSparkline?: number[];
  creditsSparkline?: number[];
  responseTimeSparkline?: number[];
  errorRateSparkline?: number[];
}

export interface MetricsCardsProps {
  metrics: UsageMetricsData | null;
  period: string;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  userTier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
}

export interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: number;
  loading?: boolean;
  footer?: string;
  sparklineData?: number[];
  sparklineColor?: string;
  progressRing?: {
    used: number;
    limit: number;
  };
}

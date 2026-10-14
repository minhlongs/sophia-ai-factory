'use client';

import type { LicenseUtilization } from '@/seed/types/license-utilization';
import type { BadgeProps } from '@/seed/components/ui/badge';

export interface LicenseUtilizationChartProps {
  data: LicenseUtilization[] | null;
  loading?: boolean;
  title?: string;
  userTier?: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
}

export const TIER_COLORS: Record<string, string> = {
  BASIC: '#3b82f6',
  PREMIUM: '#8b5cf6',
  ENTERPRISE: '#10b981',
  MASTER: '#f59e0b',
};

export function tierToBadgeVariant(tier: string): BadgeProps['variant'] {
  const lower = tier.toLowerCase();
  if (lower === 'basic' || lower === 'premium' || lower === 'enterprise') return lower;
  return 'enterprise';
}

export interface ChartDataPoint {
  name: string;
  usedCredits: number;
  availableCredits: number;
  percentage: number;
  tier: string;
  expiresAt: number | null;
}

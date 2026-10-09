/**
 * Types & Contracts for Partner Analytics & Cohort Reporting.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/analytics/types
 */

import type { PartnerTier } from '@/tree/partners/types';

export interface ClientOrderRecord {
  orderId?: string;
  timestamp: number | string; // ms timestamp or ISO string
  mrrCents: number;
}

export interface ClientMonthlyActivity {
  month: string; // "YYYY-MM"
  mrrCents: number;
  active?: boolean;
}

export interface ClientSubscriptionRecord {
  clientId: string;
  clientName?: string;
  firstOrderAt: number | string; // ms timestamp, ISO string, or "YYYY-MM"
  monthlyHistory?: ClientMonthlyActivity[];
  orders?: ClientOrderRecord[];
  currentMrrCents?: number;
  status?: 'active' | 'churned' | 'paused';
}

export interface CohortPeriodMetric {
  monthIndex: number; // 0 for cohort inception month, 1 for M+1, etc.
  activityMonth: string; // "YYYY-MM"
  activeClients: number;
  logoRetentionPct: number; // (activeClients / initialSize) * 100
  mrrCents: number;
  nrrPct: number; // (mrrCents / initialMrrCents) * 100
  logoChurnPct: number; // 100 - logoRetentionPct
  mrrChurnPct: number; // Math.max(0, 100 - nrrPct)
}

export interface CohortRow {
  cohortMonth: string; // "YYYY-MM"
  initialSize: number;
  initialMrrCents: number;
  totalRealizedRevenueCents: number;
  realizedLtvCents: number;
  periods: CohortPeriodMetric[];
  currentActiveSize?: number;
}

export interface CohortSummary {
  totalClients: number;
  activeClients: number;
  totalMrrCents: number;
  avgLtvCents: number;
  projectedLtvCents: number;
  blendedChurnPct: number;
  avgM1RetentionPct: number;
  avgM3RetentionPct: number;
  overallNrrPct: number;
  totalCohortsTracked?: number;
}

export interface CohortMatrixResult {
  cohorts: CohortRow[];
  summary: CohortSummary;
}

export interface McuLogRecord {
  id?: string;
  userId?: string;
  subaccountId?: string;
  timestamp: number | string; // ms timestamp or ISO string
  delta?: number; // negative for consumption (e.g. -50), or positive if mcuConsumed
  mcuConsumed?: number; // alternative explicit positive consumption
  reason?: string;
}

export interface McuVelocityResult {
  velocity7d: number; // Daily consumption rate over last 7 days (MCU/day)
  velocity30d: number; // Daily consumption rate over last 30 days (MCU/day)
  velocityWindowDays: number; // Daily consumption rate over custom windowDays (MCU/day)
  totalConsumedInWindow: number;
  totalConsumedLifetime: number;
  acceleration: number; // (V_7d - V_30d) / (V_30d + epsilon)
  trend: 'accelerating' | 'decelerating' | 'stable';
  currentBalance: number;
  runwayDays: number; // 999 if dormant
  exhaustionRisk: 'imminent' | 'warning' | 'healthy' | 'dormant';
}

export interface SubClientMetric {
  clientId: string;
  clientName: string;
  tier: string;
  totalOrders: number;
  lifetimeMrrCents: number;
  currentMrrCents: number;
  mcuBalance: number;
  mcuVelocityDaily: number;
  runwayDays: number;
  status: 'healthy' | 'warning' | 'imminent' | 'dormant';
  firstSeenAt: number;
  lastActiveAt: number;
}

export interface PartnerAnalyticsSummary {
  partnerId: string;
  partnerName: string;
  tier: PartnerTier;
  period: string; // e.g. "2026-09"
  generatedAt: number;
  totalSubClients: number;
  activeSubClients: number;
  totalMrrCents: number;
  monthlyCommissionCents: number;
  lifetimeEarningsCents: number;
  totalMcuAllocated: number;
  totalMcuConsumed: number;
  avgMcuVelocityDaily: number;
  avgLtvCents: number;
  blendedChurnPct: number;
  revenueGrowthPct: number;
  topSubClients: SubClientMetric[];
  cohortMatrix: CohortMatrixResult;
}

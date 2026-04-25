/**
 * Tier Adoption Analytics Types
 *
 * Used by:
 * - GET /api/analytics/tier-adoption
 * - <TierAdoptionChart /> component
 */

import type { Tier } from '@/types';

/** Single data point: daily tier subscription counts */
export interface TierAdoptionPoint {
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Tier label: BASIC | PREMIUM | ENTERPRISE | MASTER */
  tier: Tier;
  /** New subscriptions started on this date for this tier */
  newSubscriptions: number;
  /** Total active subscriptions on this date for this tier */
  totalActive: number;
}

/** Pivoted row for chart consumption: one row per date, columns per tier */
export interface TierAdoptionChartRow {
  date: string;
  BASIC: number;
  PREMIUM: number;
  ENTERPRISE: number;
  MASTER: number;
}

/** Full tier adoption response from API */
export interface TierAdoptionData {
  points: TierAdoptionPoint[];
  chartRows: TierAdoptionChartRow[];
  period: {
    from: string;
    to: string;
  };
}

/** Query params accepted by the tier-adoption endpoint */
export interface TierAdoptionQueryParams {
  /** ISO date YYYY-MM-DD */
  from: string;
  /** ISO date YYYY-MM-DD */
  to: string;
}

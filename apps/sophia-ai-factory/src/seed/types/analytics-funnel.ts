/**
 * Shared funnel analytics types.
 *
 * These types are used by both land/ (data layer) and forest/ (UI layer)
 * to avoid layer violations. Layer direction: land → forest → tree → seed
 * but shared types live in seed/ which both can import.
 *
 * @module seed/types/analytics-funnel
 */

export interface FunnelStepData {
  name: string;
  key: string;
  count: number;
  /** Percentage drop-off from the previous step (null for first step). */
  dropOffRate: number | null;
  /** Percentage of users retained since the first step. */
  conversionRate: number;
}

export interface FunnelGroup {
  id: string;
  title: string;
  description: string;
  steps: FunnelStepData[];
}

export interface FunnelDashboard {
  fromTs: number;
  toTs: number;
  funnels: FunnelGroup[];
}
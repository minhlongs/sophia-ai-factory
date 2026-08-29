/**
 * Reality Loop insight domain types (Phase J).
 *
 * Split from insights.ts to keep each module ≤200 LOC. These are the
 * public types consumed by the dashboard page and the query modules.
 *
 * @module land/reality-loop/insights-types
 */

import type { aggregateFeedbackByWorkspace } from './feedback-store';

/** One bucket in the agent.failed taxonomy count (Phase G). */
export interface FailureClassCount {
  failureClass: string;
  count: number;
}

/** Memory usage + correction rate (Q5). */
export interface MemoryInsight {
  used: number;
  corrected: number;
  /** corrected / used; null when used === 0 (no signal, not zero). */
  correctionRate: number | null;
}

/** Economic outcomes from the Phase H snapshot — all nullable. */
export interface EconomicOutcomes {
  revenueCents: number | null;
  costCents: number | null;
  netCents: number | null;
  roiPct: number | null;
}

/** The full product-learning insight bundle for one workspace. */
export interface RealityLoopInsights {
  workspaceId: string;
  /** mission.created → completion funnel. */
  missionsCreated: number;
  missionsCompleted: number;
  /** completed / created; null when created === 0. */
  completionRate: number | null;
  /** creative.accepted vs creative.rejected (Q3). */
  creativeAccepted: number;
  creativeRejected: number;
  /** accepted / (accepted + rejected); null when no creative decisions. */
  acceptanceRate: number | null;
  /** human_correction events (Q6). */
  humanCorrections: number;
  /** corrections / missions_completed; null when no completions. */
  correctionRate: number | null;
  /** agent.failed taxonomy counts (Q7). */
  agentFailures: FailureClassCount[];
  /** total agent.failed events. */
  agentFailureTotal: number;
  /** mission.cost_recorded totals (Q4). */
  missionCostCents: number;
  memory: MemoryInsight;
  economic: EconomicOutcomes;
  /** Phase E feedback aggregates (null when feedback table unavailable). */
  feedback: Awaited<ReturnType<typeof aggregateFeedbackByWorkspace>> | null;
}

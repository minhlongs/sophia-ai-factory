/**
 * Pure presentation view-model and deterministic state mapper for the
 * Sophia Creative Assembly Line (5-Station Isometric Workflow Explainer).
 *
 * Layer: tree (domain-specific reusable) — imports seed only.
 *
 * @module tree/mission/workflow-view-model
 */

import type { CreativeMissionStatus } from '@/seed/types/creative-economy';
import type { AgentRunRecord } from './agent-repo/types';

export type WorkflowMode = 'illustration' | 'verified-job';

export type WorkflowStationId =
  | 'intake_brief'
  | 'script_planning'
  | 'ceo_approval_gate'
  | 'media_render'
  | 'publish_ledger';

export type WorkflowStationState =
  | 'not_started'
  | 'queued'
  | 'running'
  | 'needs_approval'
  | 'succeeded'
  | 'failed'
  | 'unknown';

export interface WorkflowStationItem {
  id: WorkflowStationId;
  order: 1 | 2 | 3 | 4 | 5;
  state: WorkflowStationState;
  mechanismTag: string;
  costCents?: number;
  tokensUsed?: number;
  errorMessage?: string;
}

export interface WorkflowView {
  mode: WorkflowMode;
  missionId?: string;
  missionStatus?: string;
  overallState: WorkflowStationState;
  activeStationId: WorkflowStationId;
  stations: readonly [
    WorkflowStationItem,
    WorkflowStationItem,
    WorkflowStationItem,
    WorkflowStationItem,
    WorkflowStationItem,
  ];
  totalCostCents: number;
  totalTokens: number;
}

export interface BuildVerifiedWorkflowInput {
  missionId: string;
  status: CreativeMissionStatus | string;
  spentCents?: number;
  runs?: ReadonlyArray<Pick<AgentRunRecord, 'status' | 'phase' | 'totalCostCents' | 'totalTokens' | 'errorMessage'>>;
}

export { buildVerifiedMissionWorkflowView } from './workflow-verified-mapper';

const STATION_MECHANISM_TAGS: Record<WorkflowStationId, string> = {
  intake_brief: 'Dual-Niche & Jurisdiction Guard',
  script_planning: 'Bilingual AI Storyboard & FTC/MiCA',
  ceo_approval_gate: 'SHA-256 Payload Hash & Kill-Switch',
  media_render: 'Inngest Multi-Track BYOK Synthesis',
  publish_ledger: 'S2S HMAC & Domain B (0% Fee)',
};

/**
 * Builds the deterministic illustrative workflow view for the public marketing
 * Landing Hero. Strictly labeled as 'illustration' with zero random/fake timers.
 */
export function buildIllustrativeWorkflowView(): WorkflowView {
  const stations: WorkflowView['stations'] = [
    {
      id: 'intake_brief',
      order: 1,
      state: 'succeeded',
      mechanismTag: STATION_MECHANISM_TAGS.intake_brief,
    },
    {
      id: 'script_planning',
      order: 2,
      state: 'succeeded',
      mechanismTag: STATION_MECHANISM_TAGS.script_planning,
    },
    {
      id: 'ceo_approval_gate',
      order: 3,
      state: 'succeeded',
      mechanismTag: STATION_MECHANISM_TAGS.ceo_approval_gate,
    },
    {
      id: 'media_render',
      order: 4,
      state: 'running',
      mechanismTag: STATION_MECHANISM_TAGS.media_render,
    },
    {
      id: 'publish_ledger',
      order: 5,
      state: 'queued',
      mechanismTag: STATION_MECHANISM_TAGS.publish_ledger,
    },
  ];

  return {
    mode: 'illustration',
    overallState: 'running',
    activeStationId: 'ceo_approval_gate',
    stations,
    totalCostCents: 0,
    totalTokens: 0,
  };
}

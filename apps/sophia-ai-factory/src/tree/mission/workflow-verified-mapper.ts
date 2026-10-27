/**
 * Deterministic state mapper converting verified server-side Mission and
 * AgentRun records into a 5-station WorkflowView.
 *
 * Layer: tree (domain-specific reusable) — imports seed only.
 *
 * @module tree/mission/workflow-verified-mapper
 */

import type {
  BuildVerifiedWorkflowInput,
  WorkflowStationId,
  WorkflowStationItem,
  WorkflowStationState,
  WorkflowView,
} from './workflow-view-model';

const MECHANISM_TAGS: Record<WorkflowStationId, string> = {
  intake_brief: 'Dual-Niche & Jurisdiction Guard',
  script_planning: 'Bilingual AI Storyboard & FTC/MiCA',
  ceo_approval_gate: 'SHA-256 Payload Hash & Kill-Switch',
  media_render: 'Inngest Multi-Track BYOK Synthesis',
  publish_ledger: 'S2S HMAC & Domain B (0% Fee)',
};

type StateTuple = [
  WorkflowStationState,
  WorkflowStationState,
  WorkflowStationState,
  WorkflowStationState,
  WorkflowStationState,
  WorkflowStationId,
  WorkflowStationState,
];

const STATUS_MAP: Record<string, StateTuple> = {
  draft: ['running', 'not_started', 'not_started', 'not_started', 'not_started', 'intake_brief', 'running'],
  planned: ['succeeded', 'succeeded', 'queued', 'not_started', 'not_started', 'script_planning', 'queued'],
  approval_required: ['succeeded', 'succeeded', 'needs_approval', 'not_started', 'not_started', 'ceo_approval_gate', 'needs_approval'],
  running: ['succeeded', 'succeeded', 'succeeded', 'running', 'queued', 'media_render', 'running'],
  paused: ['succeeded', 'succeeded', 'succeeded', 'queued', 'not_started', 'media_render', 'queued'],
  review: ['succeeded', 'succeeded', 'needs_approval', 'succeeded', 'queued', 'ceo_approval_gate', 'needs_approval'],
  completed: ['succeeded', 'succeeded', 'succeeded', 'succeeded', 'succeeded', 'publish_ledger', 'succeeded'],
  learning: ['succeeded', 'running', 'queued', 'not_started', 'not_started', 'script_planning', 'running'],
  iterating: ['succeeded', 'running', 'queued', 'not_started', 'not_started', 'script_planning', 'running'],
  failed: ['succeeded', 'succeeded', 'succeeded', 'failed', 'not_started', 'media_render', 'failed'],
};

/**
 * Maps a real mission and its agent runs into a deterministic `verified-job`
 * WorkflowView. Never marks downstream stations succeeded when upstream failed
 * or requires approval.
 */
export function buildVerifiedMissionWorkflowView(
  input: BuildVerifiedWorkflowInput,
): WorkflowView {
  const runs = input.runs ?? [];
  const totalCostCents =
    input.spentCents ?? runs.reduce((sum, r) => sum + (r.totalCostCents || 0), 0);
  const totalTokens = runs.reduce((sum, r) => sum + (r.totalTokens || 0), 0);

  const failedRun = runs.find((r) => r.status === 'failed');
  const awaitingRun = runs.find((r) => r.status === 'awaiting_approval');

  let baseTuple: StateTuple = STATUS_MAP[input.status] ?? [
    'unknown',
    'unknown',
    'unknown',
    'unknown',
    'unknown',
    'intake_brief',
    'unknown',
  ];

  if (failedRun && input.status !== 'completed') {
    const isPlanningFailure = failedRun.phase === 'planning';
    baseTuple = isPlanningFailure
      ? ['succeeded', 'failed', 'not_started', 'not_started', 'not_started', 'script_planning', 'failed']
      : ['succeeded', 'succeeded', 'succeeded', 'failed', 'not_started', 'media_render', 'failed'];
  } else if (awaitingRun && input.status !== 'completed') {
    baseTuple = [
      'succeeded',
      'succeeded',
      'needs_approval',
      'not_started',
      'not_started',
      'ceo_approval_gate',
      'needs_approval',
    ];
  }

  const [s1, s2, s3, s4, s5, activeStationId, overallState] = baseTuple;
  const errMsg = failedRun?.errorMessage;

  const stations: WorkflowView['stations'] = [
    { id: 'intake_brief', order: 1, state: s1, mechanismTag: MECHANISM_TAGS.intake_brief },
    {
      id: 'script_planning',
      order: 2,
      state: s2,
      mechanismTag: MECHANISM_TAGS.script_planning,
      errorMessage: s2 === 'failed' ? errMsg : undefined,
    },
    { id: 'ceo_approval_gate', order: 3, state: s3, mechanismTag: MECHANISM_TAGS.ceo_approval_gate },
    {
      id: 'media_render',
      order: 4,
      state: s4,
      mechanismTag: MECHANISM_TAGS.media_render,
      costCents: totalCostCents,
      tokensUsed: totalTokens,
      errorMessage: s4 === 'failed' ? errMsg : undefined,
    },
    { id: 'publish_ledger', order: 5, state: s5, mechanismTag: MECHANISM_TAGS.publish_ledger },
  ];

  return {
    mode: 'verified-job',
    missionId: input.missionId,
    missionStatus: input.status,
    overallState,
    activeStationId,
    stations,
    totalCostCents,
    totalTokens,
  };
}

export type { WorkflowStationItem };

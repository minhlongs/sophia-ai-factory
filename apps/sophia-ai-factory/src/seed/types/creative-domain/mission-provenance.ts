/**
 * @file mission-provenance.ts
 * @description Missions, provenance auditing, and A/B experiment variants.
 * @layer seed
 */

import type { AutonomyLevel } from './autonomy';

export type CreativeMissionStatus =
  | 'draft'
  | 'planned'
  | 'approval_required'
  | 'running'
  | 'paused'
  | 'review'
  | 'completed'
  | 'learning'
  | 'iterating'
  | 'failed'
  | 'cancelled';

export interface Mission {
  id: string;
  workspaceId: string;
  creatorId: string;
  brandId?: string;
  title: string;
  objective: string;
  audience: string;
  geography: string;
  timeframeStart: number;
  timeframeEnd: number;
  budgetCents: number;
  spentCents: number;
  autonomyLevel: AutonomyLevel;
  channels: string[];
  monetizationGoals: string[];
  constraints: Record<string, unknown>;
  successMetrics: Record<string, number>;
  status: CreativeMissionStatus;
  currentPhase: string;
  createdAt: number;
  updatedAt: number;
}

export type ProvenanceAction =
  | 'created'
  | 'generated'
  | 'edited'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'derived'
  | 'archived';

export interface ProvenanceRecord {
  id: string;
  workspaceId: string;
  assetId: string;
  agentRunId?: string;
  action: ProvenanceAction;
  actorType: 'human' | 'agent' | 'system';
  actorId: string;
  model?: string;
  modelVersion?: string;
  prompt?: string;
  sourceAssetId?: string;
  humanEdits?: string;
  approvalId?: string;
  derivativeOf?: string;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export type ExperimentStatus = 'draft' | 'running' | 'completed' | 'cancelled';

export interface ExperimentVariant {
  id: string;
  experimentId: string;
  name: string; // 'A' | 'B'
  description: string;
  assetId?: string;
  trafficPercent: number;
}

export interface Experiment {
  id: string;
  workspaceId: string;
  projectId: string;
  hypothesis: string;
  metric: string;
  variants: ExperimentVariant[];
  audience: string;
  channel: string;
  status: ExperimentStatus;
  startedAt?: number;
  endedAt?: number;
  winnerVariantId?: string;
  confidence?: number;
  result?: string;
  createdAt: number;
  updatedAt: number;
}

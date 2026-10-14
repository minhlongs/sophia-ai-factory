import type { ProvenanceRecord } from '@/seed/types/creative-domain';

/** Shape of the artifacts block an agent may attach to its output. */
export interface AgentOutputArtifact {
  id?: string;
  assetId?: string;
  type?: string;
  action?: ProvenanceRecord['action'];
  model?: string;
  modelVersion?: string;
  prompt?: string;
  sourceAssetId?: string;
  derivativeOf?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentOutputArtifacts {
  assets: AgentOutputArtifact[];
}

export interface ProvenanceBridgeEventData {
  runId: string;
  agentId: string;
  missionId: string;
  totalCostCents: number;
  totalTokens: number;
}

export interface ProvenanceBridgeResult {
  success?: boolean;
  skipped?: boolean;
  reason?: string;
  runId: string;
  workspaceId?: string;
  recordedCount?: number;
  provenanceRecordIds?: string[];
}

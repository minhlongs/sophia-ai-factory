import { newProvenanceId } from '@/tree/provenance';
import type { ProvenanceRecord } from '@/seed/types/creative-domain';
import type { AgentOutputArtifact, ProvenanceBridgeEventData } from './types';

export function buildRunLevelRecord(
  runId: string,
  workspaceId: string,
  data: ProvenanceBridgeEventData,
  now: number,
): ProvenanceRecord {
  return {
    id: newProvenanceId(),
    workspaceId,
    assetId: runId,
    agentRunId: runId,
    action: 'generated',
    actorType: 'agent',
    actorId: data.agentId,
    metadata: {
      missionId: data.missionId,
      totalCostCents: data.totalCostCents,
      totalTokens: data.totalTokens,
      source: 'provenance-bridge',
    },
    createdAt: now,
  };
}

export function buildArtifactRecord(
  artifact: AgentOutputArtifact,
  runId: string,
  workspaceId: string,
  data: ProvenanceBridgeEventData,
  now: number,
): ProvenanceRecord | null {
  const assetId = artifact.assetId ?? artifact.id;
  if (!assetId) {
    return null;
  }
  return {
    id: newProvenanceId(),
    workspaceId,
    assetId,
    agentRunId: runId,
    action: artifact.action ?? 'generated',
    actorType: 'agent',
    actorId: data.agentId,
    model: artifact.model,
    modelVersion: artifact.modelVersion,
    prompt: artifact.prompt,
    sourceAssetId: artifact.sourceAssetId,
    derivativeOf: artifact.derivativeOf,
    metadata: {
      missionId: data.missionId,
      artifactType: artifact.type,
      ...(artifact.metadata ?? {}),
      source: 'provenance-bridge',
    },
    createdAt: now,
  };
}

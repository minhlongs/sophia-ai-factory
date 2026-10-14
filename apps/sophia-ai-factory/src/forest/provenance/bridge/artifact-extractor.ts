import type { AgentOutputArtifact } from './types';

/**
 * Extract the artifacts array from an agent run's outputJson.
 * Returns an empty array when the run produced no structured artifacts.
 */
export function extractArtifacts(outputJson?: Record<string, unknown> | null): AgentOutputArtifact[] {
  if (!outputJson || !Array.isArray(outputJson.assets)) {
    return [];
  }
  return outputJson.assets as AgentOutputArtifact[];
}

/**
 * Autonomy Policy Repository Types and Interfaces
 *
 * Layer: tree/autonomy
 */

import type { AutonomyTier, MissionTypePolicy } from '@/seed/types/production-factory';

export type PolicyRepoError =
  | { code: 'DB_UNAVAILABLE'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'DB_ERROR'; message: string };

/** Writable fields for upserting a mission-type policy. */
export interface MissionTypePolicyInput {
  autonomyTier: AutonomyTier;
  requirePublishApproval: boolean;
  /** Budget cap in INTEGER cents; null = no cap. */
  maxCostCentsPerRun: number | null;
  maxAutoRetries: number;
}

/** Raw snake_case row shape returned by D1. */
export interface PolicyRow {
  id: string;
  workspace_id: string;
  mission_type: string;
  autonomy_tier: number;
  require_publish_approval: number;
  max_cost_cents_per_run: number | null;
  max_auto_retries: number;
  created_at: number;
  updated_at: number;
}

export const DEFAULT_MAX_AUTO_RETRIES = 3;

export function toErrorCode(err: unknown): { code: PolicyRepoError['code']; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('not available') || message.includes('binding')) {
    return { code: 'DB_UNAVAILABLE', message };
  }
  return { code: 'DB_ERROR', message };
}

export function toPolicy(row: PolicyRow): MissionTypePolicy {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    missionType: row.mission_type,
    autonomyTier: row.autonomy_tier as AutonomyTier,
    requirePublishApproval: row.require_publish_approval === 1,
    maxCostCentsPerRun: row.max_cost_cents_per_run,
    maxAutoRetries: row.max_auto_retries,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function validateInput(input: MissionTypePolicyInput): string | null {
  if (!Number.isInteger(input.autonomyTier) || input.autonomyTier < 0 || input.autonomyTier > 3) {
    return `Invalid autonomy tier: ${input.autonomyTier}. Must be an integer 0-3.`;
  }
  if (!Number.isInteger(input.maxAutoRetries) || input.maxAutoRetries < 0) {
    return `Invalid max auto retries: ${input.maxAutoRetries}. Must be a non-negative integer.`;
  }
  if (
    input.maxCostCentsPerRun !== null &&
    (!Number.isInteger(input.maxCostCentsPerRun) || input.maxCostCentsPerRun < 0)
  ) {
    return `Invalid budget cap: ${input.maxCostCentsPerRun}. Must be null or a non-negative integer (cents).`;
  }
  return null;
}

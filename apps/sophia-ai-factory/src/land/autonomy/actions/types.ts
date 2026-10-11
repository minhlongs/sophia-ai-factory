import { z } from 'zod';
import type { AutonomyLevel } from '@/tree/autonomy';

export type AutonomyActionError =
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'NOT_AUTHENTICATED'; message: string }
  | { code: 'DB_ERROR'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'FORBIDDEN'; message: string }
  | { code: 'REPO_ERROR'; message: string; details?: string }
  | { code: 'INTERNAL'; message: string };

export const SetAutonomyLevelSchema = z.object({
  level: z.coerce.number().int().min(0).max(4),
  agentType: z.string().optional().default('global'),
});

export const SetMissionTypePolicySchema = z.object({
  missionType: z.string().min(1).max(64),
  autonomyTier: z.coerce.number().int().min(0).max(3),
  requirePublishApproval: z.boolean(),
  // z.null() first: z.coerce.number() would coerce null to 0 (a zero-cent cap).
  maxCostCentsPerRun: z.union([z.null(), z.coerce.number().int().min(0)]).optional(),
  maxAutoRetries: z.coerce.number().int().min(0).max(20).optional().default(3),
});

export interface AutonomyConfigResultValue {
  level: AutonomyLevel;
  agentType: string;
  overrides: Record<string, unknown>;
}

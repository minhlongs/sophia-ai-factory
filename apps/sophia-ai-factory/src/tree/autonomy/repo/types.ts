/**
 * Autonomy Repository Types
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/autonomy/repo/types
 */

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4;

export interface AutonomyConfig {
  id: string;
  workspaceId: string;
  agentType: string;
  level: AutonomyLevel;
  overrides: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export type AutonomyRepoError =
  | { code: 'DB_UNAVAILABLE'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'DB_ERROR'; message: string };

export const DEFAULT_LEVEL: AutonomyLevel = 1;
export const DEFAULT_OVERRIDES: Record<string, unknown> = {};

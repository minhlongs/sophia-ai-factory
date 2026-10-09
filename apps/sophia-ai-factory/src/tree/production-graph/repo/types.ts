/**
 * @file types.ts
 * @description Types and row shapes for production graph repository.
 * @layer tree
 */

import type { GraphDefinition } from '@/seed/types/production-factory';

export type GraphRepoError =
  | { code: 'DB_UNAVAILABLE'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'CONFLICT'; message: string }
  | { code: 'DB_ERROR'; message: string };

/** Writable fields for creating a production graph. */
export interface CreateGraphInput {
  id: string;
  missionType: string;
  slug: string;
  name: string;
  definition: GraphDefinition;
  isTemplate: boolean;
}

/** Writable fields for creating a production graph run. */
export interface CreateRunInput {
  id: string;
  graphId: string;
  missionId: string;
  retryCount?: number;
}

/** Raw snake_case row shapes returned by D1. */
export interface GraphRow {
  id: string;
  workspace_id: string;
  mission_type: string;
  slug: string;
  name: string;
  definition_json: string;
  is_template: number;
  created_at: number;
  updated_at: number;
}

export interface RunRow {
  id: string;
  graph_id: string;
  mission_id: string;
  workspace_id: string;
  status: string;
  phase: string;
  node_states_json: string | null;
  output_json: string | null;
  error_json: string | null;
  error_message: string | null;
  total_cost_cents: number;
  total_tokens: number;
  retry_count: number;
  created_at: number;
  started_at: number | null;
  ended_at: number | null;
}

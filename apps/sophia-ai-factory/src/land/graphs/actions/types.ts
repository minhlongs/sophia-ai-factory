/**
 * Graph Server Action Types and Schemas
 *
 * @module land/graphs/actions/types
 */

import { z } from 'zod';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

// ── Error Types ──────────────────────────────────────────────────────────────

export type GraphError = {
  code: string;
  message: string;
};

/**
 * Map a caught error to the action failure shape.
 * Tree-layer error codes pass through; anything else logs and maps to INTERNAL.
 */
export function actionFailure(scope: string, err: unknown): GraphError {
  if (err instanceof Error && (err.name === 'IPGraphError' || err.name === 'ContentGraphError')) {
    return { code: (err as Error & { code: string }).code, message: err.message };
  }

  const error = toError(err);
  logger.error(`${scope} failed`, error);
  return { code: 'INTERNAL', message: error.message };
}

// ── Validation Schemas ───────────────────────────────────────────────────────

export const ipLineageSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  ipId: z.string().min(1, 'IP ID is required'),
});

export const contentLineageSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  projectId: z.string().min(1, 'Project ID is required'),
});

export const listProjectsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  missionId: z.string().optional(),
});

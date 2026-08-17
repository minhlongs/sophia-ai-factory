/**
 * Server Actions for autonomy configuration.
 * Wraps tree-layer autonomy functions with auth and workspace permission checks.
 * All functions return Result<T, E> — no thrown exceptions across action boundaries.
 *
 * @module land/autonomy/actions
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  getAutonomyConfig,
  setAutonomyLevel,
  type AutonomyConfig,
  type AutonomyLevel,
  type AutonomyRepoError,
} from '@/tree/autonomy';

// ---------------------------------------------------------------------------
// Error type surfaced to callers
// ---------------------------------------------------------------------------

export type AutonomyActionError =
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'NOT_AUTHENTICATED'; message: string }
  | { code: 'DB_ERROR'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'FORBIDDEN'; message: string }
  | { code: 'REPO_ERROR'; message: string; details?: string }
  | { code: 'INTERNAL'; message: string };

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const SetAutonomyLevelSchema = z.object({
  level: z.coerce.number().int().min(0).max(4),
  agentType: z.string().optional().default('global'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getPrimaryWorkspaceId(userId: string): Promise<string | null> {
  try {
    const d1 = getD1();
    if (!d1) return null;
    const row = await d1
      .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
      .bind(userId)
      .first<{ org_id: string }>();
    return row?.org_id ?? null;
  } catch {
    return null;
  }
}

async function assertWorkspaceMembership(
  userId: string,
  workspaceId: string,
): Promise<Result<void, AutonomyActionError>> {
  try {
    const d1 = getD1();
    if (!d1) return failure({ code: 'DB_ERROR', message: 'Database not available' });
    const membership = await d1
      .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(workspaceId, userId)
      .first();
    if (!membership) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }
    return success(undefined);
  } catch (err) {
    const message = toError(err).message;
    logger.error('[AutonomyAction] membership check failed', { error: message, userId, workspaceId });
    return failure({ code: 'DB_ERROR', message });
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function getAutonomyConfigAction(
  workspaceId?: string,
): Promise<Result<{ level: AutonomyLevel; agentType: string; overrides: Record<string, unknown> }, AutonomyActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = getD1();
    if (!d1) return failure({ code: 'DB_ERROR', message: 'Database not available' });

    const targetWorkspaceId = workspaceId ?? (await getPrimaryWorkspaceId(user.id));
    if (!targetWorkspaceId) {
      return failure({ code: 'NOT_FOUND', message: 'No workspace found for this user' });
    }

    const membershipResult = await assertWorkspaceMembership(user.id, targetWorkspaceId);
    if (!membershipResult.ok) return membershipResult;

    const configResult = await getAutonomyConfig(targetWorkspaceId, 'global');
    if (!configResult.ok) {
      return failure({
        code: 'REPO_ERROR',
        message: configResult.error.message,
        details: configResult.error.code,
      });
    }

    return success({
      level: configResult.value.level,
      agentType: configResult.value.agentType,
      overrides: configResult.value.overrides,
    });
  } catch (err) {
    const error = toError(err);
    logger.error('[AutonomyAction] getAutonomyConfigAction failed', { error });
    return failure({ code: 'INTERNAL', message: error.message } as AutonomyActionError);
  }
}

export async function setAutonomyLevelAction(
  input: { level: number; agentType?: string },
): Promise<Result<void, AutonomyActionError>> {
  try {
    const parsed = SetAutonomyLevelSchema.safeParse(input);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = getD1();
    if (!d1) return failure({ code: 'DB_ERROR', message: 'Database not available' });

    const workspaceId = await getPrimaryWorkspaceId(user.id);
    if (!workspaceId) {
      return failure({ code: 'NOT_FOUND', message: 'No workspace found for this user' });
    }

    const membershipResult = await assertWorkspaceMembership(user.id, workspaceId);
    if (!membershipResult.ok) return membershipResult;

    const { level, agentType } = parsed.data;

    const result = await setAutonomyLevel(workspaceId, level, agentType);
    if (!result.ok) {
      return failure({
        code: 'REPO_ERROR',
        message: result.error.message,
        details: result.error.code,
      });
    }

    logger.info('[AutonomyAction] setAutonomyLevel success', { userId: user.id, workspaceId, level, agentType });
    return success(undefined);
  } catch (err) {
    const error = toError(err);
    logger.error('[AutonomyAction] setAutonomyLevelAction failed', { error });
    return failure({ code: 'INTERNAL', message: error.message } as AutonomyActionError);
  }
}
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  getAutonomyConfig,
  setAutonomyLevel,
} from '@/tree/autonomy';
import {
  SetAutonomyLevelSchema,
  type AutonomyActionError,
  type AutonomyConfigResultValue,
} from './types';
import {
  getPrimaryWorkspaceId,
  assertWorkspaceMembership,
} from './safety-gate-actions';

export async function getAutonomyConfigAction(
  workspaceId?: string,
): Promise<Result<AutonomyConfigResultValue, AutonomyActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = await getD1();
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

    const d1 = await getD1();
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

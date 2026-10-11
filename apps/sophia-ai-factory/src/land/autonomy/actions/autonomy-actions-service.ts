import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  listMissionTypePolicies,
  setMissionTypePolicy,
} from '@/tree/autonomy';
import type { MissionTypePolicy } from '@/seed/types/production-factory';
import {
  SetMissionTypePolicySchema,
  type AutonomyActionError,
} from './types';
import {
  getPrimaryWorkspaceId,
  assertWorkspaceMembership,
} from './safety-gate-actions';

export async function listMissionTypePoliciesAction(
  workspaceId?: string,
): Promise<Result<MissionTypePolicy[], AutonomyActionError>> {
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

    const result = await listMissionTypePolicies(targetWorkspaceId);
    if (!result.ok) {
      return failure({
        code: 'REPO_ERROR',
        message: result.error.message,
        details: result.error.code,
      });
    }

    return success(result.value);
  } catch (err) {
    const error = toError(err);
    logger.error('[AutonomyAction] listMissionTypePoliciesAction failed', { error });
    return failure({ code: 'INTERNAL', message: error.message } as AutonomyActionError);
  }
}

export async function setMissionTypePolicyAction(
  input: {
    missionType: string;
    autonomyTier: number;
    requirePublishApproval: boolean;
    maxCostCentsPerRun?: number | null;
    maxAutoRetries?: number;
  },
): Promise<Result<MissionTypePolicy, AutonomyActionError>> {
  try {
    const parsed = SetMissionTypePolicySchema.safeParse(input);
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

    const { missionType, autonomyTier, requirePublishApproval, maxCostCentsPerRun, maxAutoRetries } = parsed.data;

    const result = await setMissionTypePolicy(workspaceId, missionType, {
      autonomyTier: autonomyTier as MissionTypePolicy['autonomyTier'],
      requirePublishApproval,
      maxCostCentsPerRun: maxCostCentsPerRun ?? null,
      maxAutoRetries,
    });
    if (!result.ok) {
      return failure({
        code: 'REPO_ERROR',
        message: result.error.message,
        details: result.error.code,
      });
    }

    logger.info('[AutonomyAction] setMissionTypePolicy success', {
      userId: user.id,
      workspaceId,
      missionType,
      autonomyTier,
    });
    return success(result.value);
  } catch (err) {
    const error = toError(err);
    logger.error('[AutonomyAction] setMissionTypePolicyAction failed', { error });
    return failure({ code: 'INTERNAL', message: error.message } as AutonomyActionError);
  }
}

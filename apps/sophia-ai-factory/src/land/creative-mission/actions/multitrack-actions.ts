/**
 * @module land/creative-mission/actions/multitrack-actions
 * Multi-track Server Actions for creative missions: synchronous execution.
 *
 * Layer: land — imports seed and tree only.
 */

'use server';

import type { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { failure, type Result } from '@/seed/types/result';
import type { MultiTrackExecutionResult } from '@/tree/mission';
import { executeMultiTrackMissionSchema } from '../schemas';
import type { MissionError } from '../types';
import { actionFailure } from './action-helpers';
import { runAuthorizedMultiTrackMission } from './multitrack-execution-runner';

/**
 * Synchronous server action to execute a multi-track creative mission.
 * Enforces Zod schema validation, authentication, workspace IDOR protection,
 * creator/admin role authorization, legal start-state checks, and the fail-closed
 * 7-gate preflight check before delegating to the multi-track orchestrator.
 */
export async function executeMultiTrackMissionAction(
  data: z.infer<typeof executeMultiTrackMissionSchema>
): Promise<Result<MultiTrackExecutionResult, MissionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const parsed = executeMultiTrackMissionSchema.safeParse(data);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    return await runAuthorizedMultiTrackMission(user.id, parsed.data);
  } catch (err) {
    return failure(actionFailure('[CreativeMission] executeMultiTrackMissionAction', err));
  }
}

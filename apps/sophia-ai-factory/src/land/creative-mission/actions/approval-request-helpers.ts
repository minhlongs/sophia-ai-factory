/**
 * @module land/creative-mission/actions/approval-request-helpers
 * Auth, workspace access, and mission lookup helpers for approval actions.
 *
 * Layer: land — imports seed only.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1, type D1Database } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import type { MissionError } from '../types';

export interface AuthenticatedContext {
  userId: string;
  d1: D1Database;
}

export async function requireAuthAndDb(): Promise<Result<AuthenticatedContext, MissionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
  }

  const d1 = await getD1();
  if (!d1) {
    return failure({ code: 'DB_ERROR', message: 'Database not available' });
  }

  return success({ userId: user.id, d1 });
}

export async function verifyMissionWorkspaceAccess(
  missionId: string,
  userId: string,
  d1: D1Database
): Promise<Result<{ workspaceId: string }, MissionError>> {
  const mission = await d1
    .prepare('SELECT workspace_id FROM creative_missions WHERE id = ?')
    .bind(missionId)
    .first<{ workspace_id: string }>();

  if (!mission) {
    return failure({ code: 'NOT_FOUND', message: 'Mission not found' });
  }

  const hasAccess = await verifyWorkspaceAccess(mission.workspace_id, userId, d1);
  if (!hasAccess) {
    return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
  }

  return success({ workspaceId: mission.workspace_id });
}

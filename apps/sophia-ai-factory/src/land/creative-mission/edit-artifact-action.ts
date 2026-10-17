/**
 * Server Action for editing creative artifacts with audit provenance,
 * creative memory compounding, and Reality Loop telemetry emission.
 * Layer: land (business domain workflow)
 * @module land/creative-mission/edit-artifact-action
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import {
  editCreativeArtifactSchema,
  type EditCreativeArtifactInput,
  type EditCreativeArtifactResult,
  type EditArtifactError,
} from './edit-artifact-schema';
import {
  persistArtifactChanges,
  recordAuditAndLearning,
  emitTelemetrySafe,
  revalidateMissionCaches,
} from './edit-artifact-helpers';

export type {
  EditCreativeArtifactInput,
  EditCreativeArtifactResult,
  EditArtifactError,
};

export async function editCreativeArtifact(
  rawInput: unknown
): Promise<Result<EditCreativeArtifactResult, EditArtifactError>> {
  const parsed = editCreativeArtifactSchema.safeParse(rawInput);
  if (!parsed.success) {
    return failure({
      code: 'VALIDATION_ERROR',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    });
  }

  const data = parsed.data;
  const user = await getCurrentUser();
  if (!user) return failure({ code: 'UNAUTHORIZED', message: 'User not authenticated' });

  const d1 = await getD1();
  if (!d1) return failure({ code: 'DB_ERROR', message: 'D1 database unavailable' });

  const hasAccess = await verifyWorkspaceAccess(data.workspaceId, user.id, d1);
  if (!hasAccess) return failure({ code: 'FORBIDDEN', message: 'Access denied to workspace' });

  const now = Math.floor(Date.now() / 1000);
  await persistArtifactChanges(d1, data.assetId, user.id, data.editCount, data.changes, now);
  await recordAuditAndLearning(data, user.id, now);
  await emitTelemetrySafe(data);
  revalidateMissionCaches(data.missionId);

  return success({ assetId: data.assetId, version: data.editCount, updated: true });
}

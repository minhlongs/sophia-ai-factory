/**
 * Server Action for editing creative artifacts with audit provenance,
 * creative memory compounding, and Reality Loop telemetry emission.
 * Layer: land (business domain workflow)
 * @module land/creative-mission/edit-artifact-action
 */

'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { recordProvenance, newProvenanceId } from '@/tree/provenance';
import { recordLearning } from '@/tree/creative-memory';
import { emitCreativeEdited } from '@/tree/performance/loop-emitters-creative';
import {
  editCreativeArtifactSchema,
  type EditCreativeArtifactInput,
  type EditCreativeArtifactResult,
  type EditArtifactError,
} from './edit-artifact-schema';

export type {
  EditCreativeArtifactInput,
  EditCreativeArtifactResult,
  EditArtifactError,
};

async function persistArtifactChanges(
  d1: NonNullable<Awaited<ReturnType<typeof getD1>>>,
  assetId: string,
  userId: string,
  editCount: number,
  changes: Record<string, unknown>,
  now: number
): Promise<void> {
  try {
    const row = await d1
      .prepare('SELECT metadata FROM content_assets WHERE id = ?1 LIMIT 1')
      .bind(assetId)
      .first<{ metadata: string }>();

    if (!row) return;
    let existingMeta: Record<string, unknown> = {};
    try {
      existingMeta = JSON.parse(row.metadata || '{}') as Record<string, unknown>;
    } catch {
      existingMeta = {};
    }

    const mergedMeta = { ...existingMeta, ...changes, lastEditedBy: userId, editCount };
    await d1
      .prepare('UPDATE content_assets SET metadata = ?1, updated_at = ?2 WHERE id = ?3')
      .bind(JSON.stringify(mergedMeta), now, assetId)
      .run();
  } catch (err) {
    logger.warn('[EditCreativeArtifact] Failed updating content_assets (non-fatal)', {
      assetId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function recordAuditAndLearning(
  data: EditCreativeArtifactInput,
  userId: string,
  now: number
): Promise<void> {
  try {
    await recordProvenance({
      id: newProvenanceId(),
      workspaceId: data.workspaceId,
      assetId: data.assetId,
      action: 'edited',
      actorType: 'human',
      actorId: userId,
      humanEdits: JSON.stringify(data.changes),
      metadata: {
        reason: data.reason,
        editCount: data.editCount,
        missionId: data.missionId,
        graphRunId: data.graphRunId,
        nodeId: data.nodeId,
      },
      createdAt: now,
    });
  } catch (err) {
    logger.warn('[EditCreativeArtifact] Failed recording provenance (non-fatal)', {
      assetId: data.assetId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    await recordLearning(
      data.workspaceId,
      'creative',
      `edit:${data.assetId}`,
      data.changes,
      data.reason ?? 'Human artifact edit before acceptance',
      'project',
      data.missionId
    );
  } catch (err) {
    logger.warn('[EditCreativeArtifact] Failed recording creative memory (non-fatal)', {
      assetId: data.assetId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function emitTelemetrySafe(data: EditCreativeArtifactInput): Promise<void> {
  try {
    await emitCreativeEdited({
      workspaceId: data.workspaceId,
      missionId: data.missionId,
      graphRunId: data.graphRunId,
      nodeId: data.nodeId,
      assetId: data.assetId,
      agentSlug: data.agentSlug,
      editCount: data.editCount,
      recordedAt: Date.now(),
    });
  } catch (err) {
    logger.warn('[EditCreativeArtifact] Failed emitting creative.edited (non-fatal)', {
      assetId: data.assetId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function revalidateMissionCaches(missionId: string): void {
  try {
    revalidatePath('/dashboard/missions');
    revalidateTag('missions', 'max');
    revalidateTag(`mission_${missionId}`, 'max');
    revalidateTag('approvals', 'max');
  } catch {
    // Non-fatal outside Next.js request context
  }
}

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

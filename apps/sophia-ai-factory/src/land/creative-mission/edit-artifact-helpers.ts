/**
 * Internal D1 persistence, provenance, learning, and telemetry helpers for creative artifact edits.
 * @module land/creative-mission/edit-artifact-helpers
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import type { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { recordProvenance, newProvenanceId } from '@/tree/provenance';
import { recordLearning } from '@/tree/creative-memory';
import { emitCreativeEdited } from '@/tree/performance/loop-emitters-creative';
import type { EditCreativeArtifactInput } from './edit-artifact-schema';

export async function persistArtifactChanges(
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

export async function recordAuditAndLearning(
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

export async function emitTelemetrySafe(data: EditCreativeArtifactInput): Promise<void> {
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

export function revalidateMissionCaches(missionId: string): void {
  try {
    revalidatePath('/dashboard/missions');
    revalidateTag('missions', 'max');
    revalidateTag(`mission_${missionId}`, 'max');
    revalidateTag('approvals', 'max');
  } catch {
    // Non-fatal outside Next.js request context
  }
}

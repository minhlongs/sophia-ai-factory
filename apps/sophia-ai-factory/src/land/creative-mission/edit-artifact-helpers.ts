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
  workspaceId: string,
  userId: string,
  editCount: number,
  changes: Record<string, unknown>,
  now: number
): Promise<boolean> {
  try {
    const row = await d1
      .prepare('SELECT metadata, workspace_id FROM content_assets WHERE id = ?1 AND workspace_id = ?2 LIMIT 1')
      .bind(assetId, workspaceId)
      .first<{ metadata: string; workspace_id?: string }>();
    if (!row || (row.workspace_id && row.workspace_id !== workspaceId)) return false;

    let existingMeta: Record<string, unknown> = {};
    try {
      existingMeta = JSON.parse(row.metadata || '{}') as Record<string, unknown>;
    } catch {
      existingMeta = {};
    }

    const mergedMeta = { ...existingMeta, ...changes, lastEditedBy: userId, editCount };
    const res = await d1
      .prepare('UPDATE content_assets SET metadata = ?1, updated_at = ?2 WHERE id = ?3 AND workspace_id = ?4')
      .bind(JSON.stringify(mergedMeta), now, assetId, workspaceId)
      .run();

    if (res && typeof res === 'object' && 'meta' in res && res.meta && typeof res.meta.changes === 'number') {
      return res.meta.changes > 0;
    }
    return true;
  } catch (err) {
    logger.warn('[EditCreativeArtifact] Failed updating content_assets (non-fatal)', {
      assetId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
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
      metadata: { reason: data.reason, editCount: data.editCount, missionId: data.missionId, graphRunId: data.graphRunId, nodeId: data.nodeId },
      createdAt: now,
    });
  } catch (err) {
    logger.warn('[EditCreativeArtifact] Failed recording provenance (non-fatal)', { assetId: data.assetId, error: String(err) });
  }

  try {
    await recordLearning(data.workspaceId, 'creative', `edit:${data.assetId}`, data.changes, data.reason ?? 'Human artifact edit before acceptance', 'project', data.missionId);
  } catch (err) {
    logger.warn('[EditCreativeArtifact] Failed recording creative memory (non-fatal)', { assetId: data.assetId, error: String(err) });
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
    logger.warn('[EditCreativeArtifact] Failed emitting creative.edited (non-fatal)', { assetId: data.assetId, error: String(err) });
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

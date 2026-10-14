/**
 * Schema, types, and persistence/telemetry helpers for creative memory corrections.
 * @module land/creative-memory/memory-correction-helpers
 */

import { z } from 'zod';
import { logger } from '@/seed/utils/logger-utility';
import { emitMemoryCorrected } from '@/tree/performance/loop-emitters-cost';
import type { CreativeMemory } from '@/seed/types/creative-domain';
import { getD1 } from '@/seed/db/client';

export const correctionSchema = z.object({
  memoryId: z.string().min(1),
  correctedContent: z.unknown(),
  correctionReason: z.string().min(1).max(500),
  missionId: z.string().optional(),
  agentId: z.string().optional(),
  runId: z.string().optional(),
});

export type CorrectMemoryInput = z.infer<typeof correctionSchema>;

export interface CorrectMemoryResult {
  memory: CreativeMemory;
  eventEmitted: boolean;
}

export type CorrectMemoryErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'VALIDATION_FAILED'
  | 'MEMORY_NOT_FOUND'
  | 'FORBIDDEN'
  | 'DB_ERROR'
  | 'EMIT_FAILED';

export interface CorrectMemoryError {
  code: CorrectMemoryErrorCode;
  message: string;
}

export async function getMemoryWorkspaceId(memoryId: string): Promise<string | null> {
  const d1 = await getD1();
  if (!d1) return null;
  const row = await d1
    .prepare('SELECT workspace_id FROM creative_memory WHERE id = ?')
    .bind(memoryId)
    .first<{ workspace_id: string }>();
  return row?.workspace_id ?? null;
}

export function buildCorrectedMemoryEntry(params: {
  existingMemory: CreativeMemory;
  correctedContent: unknown;
  correctionReason: string;
  userId: string;
}): Omit<CreativeMemory, 'id' | 'version' | 'createdAt' | 'updatedAt'> {
  const { existingMemory, correctedContent, correctionReason, userId } = params;
  return {
    workspaceId: existingMemory.workspaceId,
    category: existingMemory.category,
    key: existingMemory.key,
    value: correctedContent,
    confidence: existingMemory.confidence,
    source: 'human_edit',
    evidence: JSON.stringify([
      ...JSON.parse(existingMemory.evidence || '[]'),
      { type: 'correction', reason: correctionReason, correctedAt: Date.now(), correctedBy: userId },
    ]),
    scope: existingMemory.scope,
    scopeId: existingMemory.scopeId,
    isDeleted: false,
    expiresAt: existingMemory.expiresAt,
  };
}

export async function emitMemoryCorrectedSafe(params: {
  memoryId: string;
  workspaceId: string;
  missionId?: string;
  agentId?: string;
  runId?: string;
  previousConfidence: CreativeMemory['confidence'];
}): Promise<boolean> {
  const { memoryId, workspaceId, missionId, agentId, runId, previousConfidence } = params;
  try {
    const emitResult = await emitMemoryCorrected({
      workspaceId,
      recordedAt: Date.now(),
      missionId: missionId ?? 'human_correction',
      agentId: agentId ?? 'human',
      runId: runId ?? 'manual',
      correctionType: 'content_correction',
      previousConfidence,
    });
    if (!emitResult) {
      logger.warn('[CorrectMemory] Failed to emit memory.corrected event (non-fatal)', {
        memoryId,
        workspaceId,
      });
    }
    return emitResult;
  } catch (emitErr) {
    logger.warn('[CorrectMemory] emitMemoryCorrected threw (non-fatal)', {
      memoryId,
      error: emitErr instanceof Error ? emitErr.message : String(emitErr),
    });
    return false;
  }
}

'use server';

/**
 * Creative Memory Correction Server Action
 *
 * Allows authenticated human users to correct creative memory entries.
 * Emits `memory.corrected` Reality Loop event for telemetry.
 *
 * @module land/creative-memory/actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { creativeMemoryStore } from '@/tree/creative-memory/creative-memory-store';
import { createCreativeMemoryEntryId } from '@/seed/types/creative-economy';
import { getD1 } from '@/seed/db/client';
import {
  correctionSchema,
  getMemoryWorkspaceId,
  buildCorrectedMemoryEntry,
  emitMemoryCorrectedSafe,
  type CorrectMemoryInput,
  type CorrectMemoryResult,
  type CorrectMemoryErrorCode,
  type CorrectMemoryError,
} from './memory-correction-helpers';

export type {
  CorrectMemoryInput,
  CorrectMemoryResult,
  CorrectMemoryErrorCode,
  CorrectMemoryError,
};

export async function correctCreativeMemory(
  input: CorrectMemoryInput,
): Promise<Result<CorrectMemoryResult, CorrectMemoryError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const parsed = correctionSchema.safeParse(input);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const { memoryId, correctedContent, correctionReason, missionId, agentId, runId } = parsed.data;

    const workspaceId = await getMemoryWorkspaceId(memoryId);
    if (!workspaceId) {
      return failure({ code: 'MEMORY_NOT_FOUND', message: 'Memory not found' });
    }

    const d1 = await getD1();
    const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id, d1 ?? undefined);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    const getResult = await creativeMemoryStore.get(createCreativeMemoryEntryId(memoryId));
    if (!getResult.ok || !getResult.value) {
      return failure({ code: 'MEMORY_NOT_FOUND', message: 'Memory not found or access denied' });
    }

    const existingMemory = getResult.value;
    const updatedEntry = buildCorrectedMemoryEntry({
      existingMemory,
      correctedContent,
      correctionReason,
      userId: user.id,
    });

    const putResult = await creativeMemoryStore.put(updatedEntry);
    if (!putResult.ok) {
      logger.error('[CorrectMemory] Failed to update memory', {
        memoryId,
        error: putResult.error,
      });
      return failure({ code: 'DB_ERROR', message: 'Failed to update memory' });
    }

    const updatedId = createCreativeMemoryEntryId(putResult.value);
    const updatedGetResult = await creativeMemoryStore.get(updatedId);
    if (!updatedGetResult.ok || !updatedGetResult.value) {
      return failure({ code: 'DB_ERROR', message: 'Failed to retrieve updated memory' });
    }

    const eventEmitted = await emitMemoryCorrectedSafe({
      memoryId,
      workspaceId,
      missionId,
      agentId,
      runId,
      previousConfidence: existingMemory.confidence,
    });

    logger.info('[CorrectMemory] Memory corrected successfully', {
      memoryId,
      workspaceId,
      correctedBy: user.id,
      correctionReason,
      eventEmitted,
    });

    return success({
      memory: updatedGetResult.value,
      eventEmitted,
    });
  } catch (err) {
    logger.error('[CorrectMemory] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}

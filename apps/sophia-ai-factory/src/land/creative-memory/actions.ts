'use server';

/**
 * Creative Memory Correction Server Action
 *
 * Allows authenticated human users to correct creative memory entries.
 * Emits `memory.corrected` Reality Loop event for telemetry.
 *
 * @module land/creative-memory/actions
 */

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { creativeMemoryStore } from '@/tree/creative-memory/creative-memory-store';
import { emitMemoryCorrected } from '@/tree/performance/loop-emitters-cost';
import { createCreativeMemoryEntryId } from '@/seed/types/creative-economy';
import type { CreativeMemory } from '@/seed/types/creative-domain';
import { getD1 } from '@/seed/db/client';

// ── Validation ────────────────────────────────────────────────────────────────

const correctionSchema = z.object({
  memoryId: z.string().min(1),
  correctedContent: z.unknown(),
  correctionReason: z.string().min(1).max(500),
  // missionId, agentId, runId are optional for human corrections
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

// ── Helpers ──────────────────────────────────────────────────────────────────

async function verifyWorkspaceAccess(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const d1 = await getD1();
  if (!d1) return false;
  const membership = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return membership !== null;
}

async function getMemoryWorkspaceId(memoryId: string): Promise<string | null> {
  const d1 = await getD1();
  if (!d1) return null;
  const row = await d1
    .prepare('SELECT workspace_id FROM creative_memory WHERE id = ?')
    .bind(memoryId)
    .first<{ workspace_id: string }>();
  return row?.workspace_id ?? null;
}

// ── Main Action ──────────────────────────────────────────────────────────────

export async function correctCreativeMemory(
  input: CorrectMemoryInput,
): Promise<Result<CorrectMemoryResult, CorrectMemoryError>> {
  try {
    // Auth gate
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    // Validate input
    const parsed = correctionSchema.safeParse(input);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const { memoryId, correctedContent, correctionReason, missionId, agentId, runId } = parsed.data;

    // Get workspace ID from memory
    const workspaceId = await getMemoryWorkspaceId(memoryId);
    if (!workspaceId) {
      return failure({ code: 'MEMORY_NOT_FOUND', message: 'Memory not found' });
    }

    // Verify workspace access
    const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'Access denied to this workspace' });
    }

    // Fetch existing memory
    const getResult = await creativeMemoryStore.get(createCreativeMemoryEntryId(memoryId));
    if (!getResult.ok || !getResult.value) {
      return failure({ code: 'MEMORY_NOT_FOUND', message: 'Memory not found or access denied' });
    }

    const existingMemory = getResult.value;

    // Create updated memory entry (same composite key, new content, incremented version)
    const updatedEntry: Omit<CreativeMemory, 'id' | 'version' | 'createdAt' | 'updatedAt'> = {
      workspaceId: existingMemory.workspaceId,
      category: existingMemory.category,
      key: existingMemory.key,
      value: correctedContent,
      confidence: existingMemory.confidence,
      source: 'human_edit',
      evidence: JSON.stringify([
        ...JSON.parse(existingMemory.evidence || '[]'),
        { type: 'correction', reason: correctionReason, correctedAt: Date.now(), correctedBy: user.id },
      ]),
      scope: existingMemory.scope,
      scopeId: existingMemory.scopeId,
      isDeleted: false,
      expiresAt: existingMemory.expiresAt,
    };

    // Upsert (will update existing by composite key, incrementing version)
    const putResult = await creativeMemoryStore.put(updatedEntry);
    if (!putResult.ok) {
      logger.error('[CorrectMemory] Failed to update memory', {
        memoryId,
        error: putResult.error,
      });
      return failure({ code: 'DB_ERROR', message: 'Failed to update memory' });
    }

    // Fetch the updated memory to return
    const updatedId = createCreativeMemoryEntryId(putResult.value);
    const updatedGetResult = await creativeMemoryStore.get(updatedId);
    if (!updatedGetResult.ok || !updatedGetResult.value) {
      return failure({ code: 'DB_ERROR', message: 'Failed to retrieve updated memory' });
    }

    // Emit Reality Loop event (side-channel, non-fatal)
    let eventEmitted = false;
    try {
      // For human corrections, we may not have mission/agent/run context
      // Use placeholders if not provided
      const emitResult = await emitMemoryCorrected({
        workspaceId,
        recordedAt: Date.now(),
        missionId: missionId ?? 'human_correction',
        agentId: agentId ?? 'human',
        runId: runId ?? 'manual',
        correctionType: 'content_correction',
        previousConfidence: existingMemory.confidence,
      });
      eventEmitted = emitResult;
      if (!eventEmitted) {
        logger.warn('[CorrectMemory] Failed to emit memory.corrected event (non-fatal)', {
          memoryId,
          workspaceId,
        });
      }
    } catch (emitErr) {
      // Non-fatal: telemetry must never abort business flow
      logger.warn('[CorrectMemory] emitMemoryCorrected threw (non-fatal)', {
        memoryId,
        error: emitErr instanceof Error ? emitErr.message : String(emitErr),
      });
    }

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
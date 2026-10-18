/**
 * Entry builder and deletion helpers for /api/creative-memory route.
 * @module app/api/creative-memory/creative-memory-handlers
 */

import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { deleteMemory, newMemoryId } from '@/tree/creative-memory';
import type { MemoryCategory, MemoryConfidence, CreativeMemory } from '@/seed/types/creative-domain';
import {
  type createMemorySchema,
  getMemoryWorkspaceId,
} from './memory-route-helpers';

export type CreateMemoryInput = z.infer<typeof createMemorySchema>;

export function buildCreativeMemoryEntry(input: CreateMemoryInput): CreativeMemory {
  const { workspaceId, category, key, value, scope, scopeId, confidence } = input;
  return {
    id: newMemoryId(),
    workspaceId,
    category: category as MemoryCategory,
    key,
    value,
    confidence: (confidence ?? 'medium') as MemoryConfidence,
    source: 'human_edit',
    evidence: JSON.stringify([]),
    scope: (scope ?? 'global') as CreativeMemory['scope'],
    scopeId,
    version: 0,
    isDeleted: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

export async function authorizeAndDeleteMemory(
  memoryId: string,
  userId: string,
): Promise<NextResponse> {
  const workspaceId = await getMemoryWorkspaceId(memoryId);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
  }

  const hasAccess = await verifyWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await deleteMemory(memoryId);
  return NextResponse.json({ deleted: true });
}

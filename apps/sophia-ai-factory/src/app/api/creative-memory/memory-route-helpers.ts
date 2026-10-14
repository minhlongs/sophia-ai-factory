/**
 * Validation schemas and helper queries for creative-memory route.
 * @module app/api/creative-memory/memory-route-helpers
 */

import { z } from 'zod';
import { createServerClient } from '@/seed/db/client';
import type { MemoryCategory, MemoryConfidence, CreativeMemory } from '@/seed/types/creative-domain';

export const MEMORY_CATEGORIES: MemoryCategory[] = [
  'identity', 'creative', 'audience', 'performance',
  'business', 'operational', 'provenance',
];

export const MEMORY_SCOPES: CreativeMemory['scope'][] = [
  'global', 'campaign', 'project', 'channel',
];

export const MEMORY_CONFIDENCES: MemoryConfidence[] = ['high', 'medium', 'low'];

export const createMemorySchema = z.object({
  workspaceId: z.string().min(1),
  category: z.enum(MEMORY_CATEGORIES as [string, ...string[]]),
  key: z.string().min(1),
  value: z.unknown(),
  scope: z.enum(MEMORY_SCOPES as [string, ...string[]]).optional(),
  scopeId: z.string().optional(),
  confidence: z.enum(MEMORY_CONFIDENCES as [string, ...string[]]).optional(),
});

export const deleteMemorySchema = z.object({
  id: z.string().min(1),
});

export async function getMemoryWorkspaceId(memoryId: string): Promise<string | null> {
  const d1 = createServerClient();
  const row = await d1
    .prepare('SELECT workspace_id FROM creative_memory WHERE id = ? AND is_deleted = 0')
    .bind(memoryId)
    .first<{ workspace_id: string; is_deleted?: number }>();
  if (!row) return null;
  if ('is_deleted' in row && row.is_deleted === 1) return null;
  return row.workspace_id ?? null;
}

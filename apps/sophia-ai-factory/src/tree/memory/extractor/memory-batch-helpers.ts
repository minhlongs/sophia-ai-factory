/**
 * Memory Extraction Batch Helpers — deduplication, capping, and persistence.
 *
 * Layer: tree/memory (Domain reusable)
 *
 * @module tree/memory/extractor/memory-batch-helpers
 */

import type { MemoryRepository, StoredMemory } from '../memory-repository';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { CreatorMemoryType } from '@/seed/db/types';
import type { ExtractedMemory } from './types';

export function capMemoriesByTypeBatch(
  memories: ExtractedMemory[],
  maxPerType: number,
): { capped: ExtractedMemory[]; skipped: number } {
  let skipped = 0;
  const byType = new Map<CreatorMemoryType, ExtractedMemory[]>();

  for (const m of memories) {
    const existing = byType.get(m.memoryType) ?? [];
    if (existing.length < maxPerType) {
      existing.push(m);
    } else {
      skipped++;
    }
    byType.set(m.memoryType, existing);
  }

  const capped: ExtractedMemory[] = [];
  for (const arr of byType.values()) {
    capped.push(...arr);
  }

  return { capped, skipped };
}

export function dedupExtractedMemories(memories: ExtractedMemory[]): ExtractedMemory[] {
  const seen = new Set<string>();
  const result: ExtractedMemory[] = [];

  // Sort by confidence DESC to keep the highest-confidence variant.
  const sorted = [...memories].sort((a, b) => b.confidence - a.confidence);

  for (const mem of sorted) {
    const key = `${mem.memoryType}:${mem.category}:${mem.content.text.slice(0, 50)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(mem);
  }

  return result;
}

export async function persistExtractedMemoriesBatch(
  repo: MemoryRepository,
  userId: string,
  memories: ExtractedMemory[],
): Promise<StoredMemory[]> {
  const stored: StoredMemory[] = [];
  for (const mem of memories) {
    try {
      const storedMem = await repo.store(userId, mem.memoryType, mem.category, mem.content, {
        relevanceScore: mem.confidence,
      });
      stored.push(storedMem);
    } catch (err) {
      logger.error('[MemoryExtractor] Failed to store memory', {
        userId,
        memoryType: mem.memoryType,
        category: mem.category,
        error: getErrorMessage(err),
      });
    }
  }
  return stored;
}

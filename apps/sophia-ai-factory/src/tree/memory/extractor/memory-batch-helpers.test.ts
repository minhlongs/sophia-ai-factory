import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreatorMemoryType } from '@/seed/db/types';
import type { MemoryRepository, StoredMemory } from '../memory-repository';
import type { ExtractedMemory } from './types';

const logger = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('@/seed/utils/logger-utility', () => ({ logger }));

import { capMemoriesByTypeBatch, dedupExtractedMemories, persistExtractedMemoriesBatch } from './memory-batch-helpers';

function memory(
  text: string,
  memoryType: CreatorMemoryType = 'preference',
  category = 'style',
  confidence = 0.5,
): ExtractedMemory {
  return { memoryType, category, content: { text }, confidence };
}

function storedMemory(userId: string, input: ExtractedMemory): StoredMemory {
  return {
    id: `stored-${input.content.text}`,
    userId,
    memoryType: input.memoryType,
    category: input.category,
    content: input.content,
    relevanceScore: input.confidence,
    sourceExecutionId: null,
    expiresAt: null,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('capMemoriesByTypeBatch', () => {
  it('caps each type independently and groups output by first-seen type', () => {
    const inputs = [
      memory('pref-1'),
      memory('episode-1', 'episodic', 'event'),
      memory('pref-2'),
      memory('semantic-1', 'semantic', 'fact'),
      memory('pref-3'),
      memory('episode-2', 'episodic', 'event'),
    ];
    const result = capMemoriesByTypeBatch(inputs, 2);
    expect(result.capped.map((item) => item.content.text)).toEqual([
      'pref-1', 'pref-2', 'episode-1', 'episode-2', 'semantic-1',
    ]);
    expect(result.skipped).toBe(1);
    expect(inputs).toHaveLength(6);
  });

  it('skips all memories when the per-type cap is zero', () => {
    expect(capMemoriesByTypeBatch([memory('a'), memory('b', 'episodic')], 0)).toEqual({
      capped: [], skipped: 2,
    });
  });
});

describe('dedupExtractedMemories', () => {
  it('keeps the highest-confidence duplicate and distinguishes type and category', () => {
    const lower = memory('A preference about tone', 'preference', 'style', 0.4);
    const higher = memory('A preference about tone', 'preference', 'style', 0.9);
    const samePrefix = memory(`${'x'.repeat(50)}first suffix`, 'semantic', 'fact', 0.7);
    const prefixDuplicate = memory(`${'x'.repeat(50)}different suffix`, 'semantic', 'fact', 0.2);

    const result = dedupExtractedMemories([
      lower,
      memory('A preference about tone', 'episodic', 'style', 0.8),
      memory('A preference about tone', 'preference', 'voice', 0.6),
      samePrefix,
      higher,
      prefixDuplicate,
    ]);

    expect(result).toEqual([higher,
      memory('A preference about tone', 'episodic', 'style', 0.8),
      samePrefix,
      memory('A preference about tone', 'preference', 'voice', 0.6),
    ]);
    expect(result).not.toContain(lower);
    expect(result).not.toContain(prefixDuplicate);
  });

  it('returns an empty list for empty input without mutating its argument', () => {
    const input: ExtractedMemory[] = [];
    expect(dedupExtractedMemories(input)).toEqual([]);
    expect(input).toEqual([]);
  });
});

describe('persistExtractedMemoriesBatch', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('stores in order, forwards confidence, and continues after individual failures', async () => {
    const inputs = [memory('first', 'preference', 'style', 0.9), memory('broken', 'semantic', 'fact', 0.7), memory('last', 'episodic', 'event', 0.5)];
    const calls: string[] = [];
    const store = vi.fn(async (userId: string, _type: CreatorMemoryType, _category: string, content: { text: string }, options?: { relevanceScore?: number }) => {
      calls.push(content.text);
      if (content.text === 'broken') throw new Error('database write failed');
      expect(options?.relevanceScore).toBe(inputs.find((input) => input.content.text === content.text)?.confidence);
      return storedMemory(userId, inputs.find((input) => input.content.text === content.text) as ExtractedMemory);
    });
    const repo = { store } as unknown as MemoryRepository;

    const result = await persistExtractedMemoriesBatch(repo, 'user-1', inputs);

    expect(calls).toEqual(['first', 'broken', 'last']);
    expect(result).toEqual([storedMemory('user-1', inputs[0]), storedMemory('user-1', inputs[2])]);
    expect(logger.error).toHaveBeenCalledWith('[MemoryExtractor] Failed to store memory', expect.objectContaining({
      userId: 'user-1', memoryType: 'semantic', category: 'fact', error: 'database write failed',
    }));
  });

  it('returns an empty list without touching the repository for empty input', async () => {
    const store = vi.fn();
    await expect(persistExtractedMemoriesBatch({ store } as unknown as MemoryRepository, 'user-1', [])).resolves.toEqual([]);
    expect(store).not.toHaveBeenCalled();
  });
});

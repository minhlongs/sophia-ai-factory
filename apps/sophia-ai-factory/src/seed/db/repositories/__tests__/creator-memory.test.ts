import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addMemory,
  addEpisodicFromExecution,
  getRelevantMemories,
  updateMemoryRelevance,
  pruneExpiredMemories,
  getCreatorProfile,
} from '@/seed/db/repositories/creator-memory';

describe('Creator Memory Repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports expected CRUD functions', () => {
    expect(typeof addMemory).toBe('function');
    expect(typeof addEpisodicFromExecution).toBe('function');
    expect(typeof getRelevantMemories).toBe('function');
    expect(typeof updateMemoryRelevance).toBe('function');
    expect(typeof pruneExpiredMemories).toBe('function');
    expect(typeof getCreatorProfile).toBe('function');
  });

  it('returns empty array when D1 fails gracefully in getRelevantMemories', async () => {
    const res = await getRelevantMemories('user-none');
    expect(res).toEqual([]);
  });

  it('returns empty profile when D1 fails gracefully in getCreatorProfile', async () => {
    const profile = await getCreatorProfile('user-none');
    expect(profile).toEqual({ semantic: {}, preferences: {} });
  });

  it('returns 0 when pruneExpiredMemories fails gracefully', async () => {
    const deleted = await pruneExpiredMemories();
    expect(deleted).toBe(0);
  });
});

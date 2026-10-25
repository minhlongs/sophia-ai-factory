/**
 * Unit tests for deterministic image generation idempotency and deduplication.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  buildImageIdempotencyKey,
  findRecentDuplicateImageJob,
} from '../image-generation-idempotency';
import type { createServerClient } from '@/seed/db/client';

describe('buildImageIdempotencyKey', () => {
  it('returns the exact same key for identical normalized inputs in the same bucket', () => {
    const k1 = buildImageIdempotencyKey({
      userId: 'user_1',
      prompt: '  A cat   on a rooftop ',
      model: 'fal-ai/flux-schnell',
      aspectRatio: '16:9',
      windowBucket: 1000,
    });
    const k2 = buildImageIdempotencyKey({
      userId: 'user_1',
      prompt: 'A cat on a rooftop',
      model: 'fal-ai/flux-schnell',
      aspectRatio: '16:9',
      windowBucket: 1000,
    });

    expect(k1).toBe(k2);
    expect(k1).toMatch(/^req_[0-9a-f]{64}$/);
  });

  it('produces distinct keys when userId, model, prompt, aspectRatio, or bucket differs', () => {
    const base = {
      userId: 'user_1',
      prompt: 'A cat on a rooftop',
      model: 'fal-ai/flux-schnell',
      aspectRatio: '1:1',
      windowBucket: 1000,
    };

    const kBase = buildImageIdempotencyKey(base);
    expect(buildImageIdempotencyKey({ ...base, userId: 'user_2' })).not.toBe(kBase);
    expect(buildImageIdempotencyKey({ ...base, prompt: 'A dog on a rooftop' })).not.toBe(kBase);
    expect(buildImageIdempotencyKey({ ...base, model: 'fal-ai/flux/dev' })).not.toBe(kBase);
    expect(buildImageIdempotencyKey({ ...base, aspectRatio: '16:9' })).not.toBe(kBase);
    expect(buildImageIdempotencyKey({ ...base, windowBucket: 1001 })).not.toBe(kBase);
  });
});

describe('findRecentDuplicateImageJob', () => {
  function makeStubDb(rows: unknown[] | null, err: { message: string } | null = null) {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order']) {
      chain[m] = vi.fn(() => chain);
    }
    chain.limit = vi.fn(() => Promise.resolve({ data: rows, error: err }));
    return {
      from: vi.fn(() => chain),
    } as unknown as ReturnType<typeof createServerClient>;
  }

  it('returns the existing jobId when an identical non-failed job is within the window', async () => {
    const db = makeStubDb([
      {
        id: 'fal-existing-123',
        status: 'completed',
        prompt: 'A sunset over mountains',
        model: 'fal-ai/flux-schnell',
        requested_at: 1700000050,
      },
    ]);

    const dup = await findRecentDuplicateImageJob(db, {
      userId: 'u1',
      prompt: '  A sunset over mountains ',
      model: 'fal-ai/flux-schnell',
      nowSeconds: 1700000080,
      windowSeconds: 60,
    });

    expect(dup).toBe('fal-existing-123');
  });

  it('ignores failed jobs so the user can retry after a failure', async () => {
    const db = makeStubDb([
      {
        id: 'fal-failed-123',
        status: 'failed',
        prompt: 'A sunset over mountains',
        model: 'fal-ai/flux-schnell',
        requested_at: 1700000050,
      },
    ]);

    const dup = await findRecentDuplicateImageJob(db, {
      userId: 'u1',
      prompt: 'A sunset over mountains',
      model: 'fal-ai/flux-schnell',
      nowSeconds: 1700000080,
      windowSeconds: 60,
    });

    expect(dup).toBeNull();
  });

  it('ignores jobs outside the deduplication time window', async () => {
    const db = makeStubDb([
      {
        id: 'fal-old-123',
        status: 'completed',
        prompt: 'A sunset over mountains',
        model: 'fal-ai/flux-schnell',
        requested_at: 1700000000,
      },
    ]);

    const dup = await findRecentDuplicateImageJob(db, {
      userId: 'u1',
      prompt: 'A sunset over mountains',
      model: 'fal-ai/flux-schnell',
      nowSeconds: 1700000120,
      windowSeconds: 60,
    });

    expect(dup).toBeNull();
  });
});

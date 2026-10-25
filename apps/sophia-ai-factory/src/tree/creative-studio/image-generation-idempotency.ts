/**
 * Deterministic Idempotency & Deduplication for Image Generation
 *
 * Prevents accidental double-billing when a customer double-clicks or retries
 * the exact same image generation brief within a short deduplication window.
 *
 * @module tree/creative-studio/image-generation-idempotency
 */

import { sha256 } from '@/seed/security/crypto-utils';
import type { createServerClient } from '@/seed/db/client';

/** Default deduplication window in seconds (60 seconds). */
export const IMAGE_IDEMPOTENCY_WINDOW_SEC = 60;

export interface ImageIdempotencyInput {
  userId: string;
  prompt: string;
  model: string;
  aspectRatio?: string;
  windowBucket?: number;
}

/**
 * Computes a deterministic SHA-256 idempotency key for an image generation
 * request. Requests with identical `(userId, prompt.trim(), model, aspectRatio)`
 * in the same time bucket produce the exact same key.
 */
export function buildImageIdempotencyKey(input: ImageIdempotencyInput): string {
  const bucket =
    input.windowBucket ??
    Math.floor(Date.now() / 1000 / IMAGE_IDEMPOTENCY_WINDOW_SEC);
  const normalizedPrompt = input.prompt.trim().replace(/\s+/g, ' ');
  const ratio = input.aspectRatio ?? '1:1';
  const payload = `img:${input.userId}:${input.model}:${ratio}:${bucket}:${normalizedPrompt}`;
  return `req_${sha256(payload)}`;
}

/**
 * Checks whether the user already has a recent non-failed image job with the
 * exact same `(model, prompt)` inside the deduplication window.
 *
 * Fails open (returns null) if the D1 read errors or is stubbed in unit tests,
 * so a transient query failure never blocks a legitimate generation.
 */
export async function findRecentDuplicateImageJob(
  db: ReturnType<typeof createServerClient>,
  params: {
    userId: string;
    prompt: string;
    model: string;
    windowSeconds?: number;
    nowSeconds?: number;
  },
): Promise<string | null> {
  try {
    const windowSec = params.windowSeconds ?? IMAGE_IDEMPOTENCY_WINDOW_SEC;
    const nowSec = params.nowSeconds ?? Math.floor(Date.now() / 1000);
    const cutoff = nowSec - windowSec;
    const trimmedPrompt = params.prompt.trim();

    const chain = db.from('media_jobs');
    if (typeof chain?.select !== 'function') {
      return null;
    }

    const { data, error } = (await chain
      .select('id, status, prompt, model, created_at, requested_at')
      .eq('user_id', params.userId)
      .eq('type', 'image')
      .eq('model', params.model)
      .order('created_at', { ascending: false })
      .limit(5)) as {
      data: Array<{
        id?: unknown;
        status?: unknown;
        prompt?: unknown;
        created_at?: unknown;
        requested_at?: unknown;
      }> | null;
      error: { message: string } | null;
    };

    if (error || !Array.isArray(data)) {
      return null;
    }

    for (const row of data) {
      const status = String(row.status ?? '');
      if (status === 'failed') continue;

      const rowPrompt = typeof row.prompt === 'string' ? row.prompt.trim() : '';
      if (rowPrompt !== trimmedPrompt) continue;

      const ts = Number(row.requested_at ?? row.created_at ?? 0);
      if (ts > 0 && ts >= cutoff && typeof row.id === 'string' && row.id.length > 0) {
        return row.id;
      }
    }

    return null;
  } catch {
    return null;
  }
}

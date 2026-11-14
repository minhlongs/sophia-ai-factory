/**
 * Types, supported model catalog, and funding guard for MuAPI Media Generation Client.
 * @module tree/clients/muapi-media-types
 */

import { SUPPORTED_IMAGE_MODELS } from '@/seed/config/tiers/supported-image-models';

export const MUAPI_BASE = 'https://api.muapi.ai/v1';

export type MediaType = 'image' | 'video' | 'audio';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Explicit funding source for every MuAPI transport call.
 *
 * Making the funding source a required discriminated union makes silent
 * fallback onto `process.env.MUAPI_API_KEY` unrepresentable at compile time
 * and rejected at runtime before any network or circuit-breaker side effects.
 */
export type MuApiFunding =
  | { readonly fund: 'byok'; readonly apiKey: string }
  | { readonly fund: 'platform' };

export type ResolvedMuApiFunding =
  | { readonly ok: true; readonly apiKey: string; readonly fund: 'byok' | 'platform' }
  | { readonly ok: false; readonly error: string; readonly code: 'NO_API_KEY' | 'INVALID_FUNDING' };

export interface MediaGenerationRequest {
  type: MediaType;
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  duration?: number;
  style?: string;
  seed?: number;
  imageUrl?: string;
}

export interface MediaJob {
  id: string;
  status: JobStatus;
  type: MediaType;
  model: string;
  resultUrl?: string;
  thumbnailUrl?: string;
  progress?: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface MediaGenerationResult {
  success: boolean;
  job?: MediaJob;
  error?: string;
  code?: string;
}

/** Supported models per media type */
export const SUPPORTED_MODELS: Record<MediaType, string[]> = {
  image: [...SUPPORTED_IMAGE_MODELS],
  video: ['kling-3.0', 'seedance-2.0', 'veo3', 'kling-lip-sync'],
  audio: ['suno-v4', 'mmaudio'],
};

/**
 * Resolves the bearer credential from an explicit `MuApiFunding` union.
 *
 * - `{ fund: 'byok', apiKey }` never reads `process.env.MUAPI_API_KEY`; blank
 *   or non-string `apiKey` values fail closed with `NO_API_KEY`.
 * - `{ fund: 'platform' }` explicitly opts into `process.env.MUAPI_API_KEY`.
 * - Missing, non-object, inherited (`__proto__`, `constructor`), or unknown
 *   `fund` discriminants fail closed with `INVALID_FUNDING` without touching
 *   `process.env.MUAPI_API_KEY`.
 */
export function resolveMuApiFunding(funding: MuApiFunding): ResolvedMuApiFunding {
  if (
    typeof funding !== 'object' ||
    funding === null ||
    !Object.hasOwn(funding, 'fund')
  ) {
    return {
      ok: false,
      code: 'INVALID_FUNDING',
      error: 'Explicit MuApiFunding ({ fund: "byok", apiKey } | { fund: "platform" }) is required',
    };
  }

  if (funding.fund === 'byok') {
    const trimmed = typeof funding.apiKey === 'string' ? funding.apiKey.trim() : '';
    if (!trimmed) {
      return {
        ok: false,
        code: 'NO_API_KEY',
        error: 'MuAPI BYOK apiKey is required',
      };
    }
    return { ok: true, apiKey: trimmed, fund: 'byok' };
  }

  if (funding.fund === 'platform') {
    const platformKey = process.env.MUAPI_API_KEY?.trim() ?? '';
    if (!platformKey) {
      return {
        ok: false,
        code: 'NO_API_KEY',
        error: 'MUAPI_API_KEY not configured',
      };
    }
    return { ok: true, apiKey: platformKey, fund: 'platform' };
  }

  return {
    ok: false,
    code: 'INVALID_FUNDING',
    error: 'Explicit MuApiFunding ({ fund: "byok", apiKey } | { fund: "platform" }) is required',
  };
}

/**
 * Derives a non-reversible circuit-breaker bucket key reference so one BYOK
 * tenant's failures cannot trip `muapi:platform` for other tenants, without
 * storing any raw credential prefix in memory or D1.
 */
export async function resolveMuApiBreakerKeyRef(
  resolved: Extract<ResolvedMuApiFunding, { readonly ok: true }>,
): Promise<string> {
  if (resolved.fund === 'platform') {
    return 'platform';
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(resolved.apiKey));
  const bytes = new Uint8Array(digest).subarray(0, 8);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return `byok_${hex}`;
}

/**
 * Normalizes upstream MuAPI status values onto the canonical `JobStatus` union.
 * Maps upstream cancellation synonyms (`canceled`, `cancelled`) to `'failed'`
 * so terminal jobs do not remain stuck in an infinite polling loop.
 */
export function normalizeMuApiJobStatus(
  rawStatus: unknown,
  fallback?: JobStatus,
): JobStatus | null {
  if (typeof rawStatus !== 'string') {
    return fallback ?? null;
  }
  const normalized = rawStatus.trim().toLowerCase();
  if (!normalized) {
    return fallback ?? null;
  }
  if (
    normalized === 'pending' ||
    normalized === 'processing' ||
    normalized === 'completed' ||
    normalized === 'failed'
  ) {
    return normalized;
  }
  if (normalized === 'canceled' || normalized === 'cancelled') {
    return 'failed';
  }
  return null;
}

/**
 * Validates that a job identifier is a single path segment safe to pass to
 * `/jobs/{id}` (no blank strings, path separators, traversal, query, or hash).
 */
export function isSafeMuApiJobId(jobId: unknown): jobId is string {
  return (
    typeof jobId === 'string' &&
    jobId.trim().length > 0 &&
    jobId.length <= 128 &&
    jobId === jobId.trim() &&
    !/[/\\?#%\s]/.test(jobId) &&
    jobId !== '.' &&
    jobId !== '..'
  );
}

/**
 * Check if a model is supported
 */
export function isModelSupported(type: MediaType, model: string): boolean {
  return SUPPORTED_MODELS[type]?.includes(model) ?? false;
}

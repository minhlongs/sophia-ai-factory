/**
 * BYOK Key Format Validator Types
 * Layer: TREE (Business Logic)
 */

/**
 * Mirror of UserSettableProvider in byok-key-form. Kept inline so this lib
 * stays free of the 'use client' boundary and can run server-side too.
 */
export type ValidatorProvider =
  | 'openrouter'
  | 'anthropic'
  | 'elevenlabs'
  | 'd-id'
  | 'heygen'
  | 'muapi'
  | 'apollo'
  | 'hunter'
  | 'replicate'
  | 'fal-ai';

export interface ValidatorResult {
  /** True if the key passes provider-specific format checks. */
  ok: boolean;
  /** Translation key under `byok.validate.*` to render when ok=false. */
  errorKey?: string;
  /**
   * Auto-corrected key value. When present, callers should replace the
   * raw input with this value before submit (and surface
   * `byok.validate.did.auto_encoded` as a non-error hint).
   */
  autoEncoded?: string;
}

/** Minimum sane length shared across all providers (matches existing form guard). */
export const MIN_LENGTH = 10;

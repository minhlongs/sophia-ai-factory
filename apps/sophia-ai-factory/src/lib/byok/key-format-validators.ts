/**
 * BYOK Key Format Validators — Phase 03 acquisition-push.
 *
 * Per-provider format validation that runs client-side so customers see an
 * actionable hint BEFORE submitting a malformed key (and receiving a raw
 * provider `401`). Designed to compose with the existing length >= 10 guard
 * in byok-key-form; this layer adds provider-specific shape checks.
 *
 * Closes handover §8 gotchas: ElevenLabs xi-api-key format, D-ID base64
 * auto-encode, OpenRouter / Anthropic prefix.
 *
 * @module lib/byok/key-format-validators
 */

/**
 * Mirror of UserSettableProvider in byok-key-form. Kept inline so this lib
 * stays free of the 'use client' boundary and can run server-side too.
 */
export type ValidatorProvider = 'openrouter' | 'anthropic' | 'elevenlabs' | 'd-id' | 'muapi' | 'apollo' | 'hunter'

export interface ValidatorResult {
  /** True if the key passes provider-specific format checks. */
  ok: boolean
  /** Translation key under `byok.validate.*` to render when ok=false. */
  errorKey?: string
  /**
   * Auto-corrected key value. When present, callers should replace the
   * raw input with this value before submit (and surface
   * `byok.validate.did.auto_encoded` as a non-error hint).
   */
  autoEncoded?: string
}

/** Minimum sane length shared across all providers (matches existing form guard). */
const MIN_LENGTH = 10

/** OpenRouter keys: `sk-or-v1-<64 hex>` per current docs (2026). Lenient regex. */
const OPENROUTER_RE = /^sk-or-/

/** Anthropic keys: `sk-ant-api03-...`. Lenient prefix check. */
const ANTHROPIC_RE = /^sk-ant-/

/** ElevenLabs xi-api-key: 32+ char alphanumeric or `sk_<32+>`. Lenient. */
const ELEVENLABS_RE = /^[A-Za-z0-9_-]{20,}$/

/** MuAPI tokens: 20+ char alphanumeric. */
const MUAPI_RE = /^[A-Za-z0-9_-]{20,}$/

/**
 * D-ID Basic-auth format detection.
 * Raw form (issued by dashboard): `email:password` — must be base64-encoded
 * before the Authorization header. Encoded form: standard base64 alphabet.
 */
const DID_EMAIL_PASSWORD_RE = /^[^@\s]+@[^@\s:]+\.[^@\s:]+:[^@\s]+$/
const DID_BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/

/**
 * Base64-encode using browser-safe btoa when available, Buffer fallback for tests.
 * Returns the value as-is if encoding fails (caller falls back to "invalid").
 */
function safeBase64(value: string): string {
  try {
    if (typeof btoa === 'function') return btoa(value)
    // Node.js fallback (Vitest env)
    return Buffer.from(value, 'utf-8').toString('base64')
  } catch {
    return value
  }
}

function shortFail(): ValidatorResult {
  return { ok: false, errorKey: 'byok.validate.too_short' }
}

/** OpenRouter format guard. */
export function validateOpenRouter(key: string): ValidatorResult {
  const trimmed = key.trim()
  if (trimmed.length < MIN_LENGTH) return shortFail()
  if (!OPENROUTER_RE.test(trimmed)) {
    return { ok: false, errorKey: 'byok.validate.openrouter.format' }
  }
  return { ok: true }
}

/** Anthropic format guard. */
export function validateAnthropic(key: string): ValidatorResult {
  const trimmed = key.trim()
  if (trimmed.length < MIN_LENGTH) return shortFail()
  if (!ANTHROPIC_RE.test(trimmed)) {
    return { ok: false, errorKey: 'byok.validate.anthropic.format' }
  }
  return { ok: true }
}

/** ElevenLabs xi-api-key guard. */
export function validateElevenLabs(key: string): ValidatorResult {
  const trimmed = key.trim()
  if (trimmed.length < MIN_LENGTH) return shortFail()
  if (!ELEVENLABS_RE.test(trimmed)) {
    return { ok: false, errorKey: 'byok.validate.elevenlabs.format' }
  }
  return { ok: true }
}

/**
 * D-ID guard with auto-base64 for raw `email:password` paste.
 *
 * Decision tree:
 *  - matches `email:password` → base64-encode + return autoEncoded
 *  - matches base64 alphabet → accept as-is
 *  - otherwise → error
 */
export function validateDID(key: string): ValidatorResult {
  const trimmed = key.trim()
  if (trimmed.length < MIN_LENGTH) return shortFail()
  if (DID_EMAIL_PASSWORD_RE.test(trimmed)) {
    const encoded = safeBase64(trimmed)
    if (encoded === trimmed) {
      return { ok: false, errorKey: 'byok.validate.did.format' }
    }
    return { ok: true, autoEncoded: encoded }
  }
  if (DID_BASE64_RE.test(trimmed)) return { ok: true }
  return { ok: false, errorKey: 'byok.validate.did.format' }
}

/** MuAPI 20+ char token. */
export function validateMuapi(key: string): ValidatorResult {
  const trimmed = key.trim()
  if (trimmed.length < MIN_LENGTH) return shortFail()
  if (!MUAPI_RE.test(trimmed)) {
    return { ok: false, errorKey: 'byok.validate.muapi.format' }
  }
  return { ok: true }
}

/**
 * Provider-agnostic dispatcher used by the form. Falls back to length-only
 * check for any provider not explicitly enumerated (defensive forward-compat).
 */
export function validateProviderKey(provider: ValidatorProvider, key: string): ValidatorResult {
  switch (provider) {
    case 'openrouter':
      return validateOpenRouter(key)
    case 'anthropic':
      return validateAnthropic(key)
    case 'elevenlabs':
      return validateElevenLabs(key)
    case 'd-id':
      return validateDID(key)
    case 'muapi':
      return validateMuapi(key)
    default: {
      const trimmed = key.trim()
      return trimmed.length >= MIN_LENGTH ? { ok: true } : shortFail()
    }
  }
}

/**
 * Provider-Specific Key Format Validation Rules
 * Layer: TREE (Business Logic)
 */

import { MIN_LENGTH, type ValidatorResult } from './types';
import { sanitizeCredential, safeBase64, shortFail } from './credential-sanitizer';

/** OpenRouter keys: `sk-or-v1-<64 hex>` per current docs (2026). Lenient regex. */
const OPENROUTER_RE = /^sk-or-[A-Za-z0-9_-]+$/;

/** Anthropic keys: `sk-ant-api03-...`. Lenient prefix check. */
const ANTHROPIC_RE = /^sk-ant-[A-Za-z0-9_-]+$/;

/** ElevenLabs xi-api-key: 32+ char alphanumeric or `sk_<32+>`. Lenient. */
const ELEVENLABS_RE = /^[A-Za-z0-9_-]{20,}$/;

/** MuAPI tokens: 20+ char alphanumeric. */
const MUAPI_RE = /^[A-Za-z0-9_-]{20,}$/;

/** Apollo tokens: 20+ char alphanumeric. */
const APOLLO_RE = /^[A-Za-z0-9_-]{20,}$/;

/** Hunter tokens: 20+ char alphanumeric. */
const HUNTER_RE = /^[A-Za-z0-9_-]{20,}$/;

/** Replicate tokens: `r8_<32+ alphanumeric>`. Minimal prefix + length check. */
const REPLICATE_RE = /^r8_[A-Za-z0-9_-]{32,}$/;

/**
 * D-ID Basic-auth format detection.
 * Raw form (issued by dashboard): `email:password` — must be base64-encoded
 * before the Authorization header. Encoded form: standard base64 alphabet.
 */
const DID_EMAIL_PASSWORD_RE = /^[^@\s]+@[^@\s:]+\.[^@\s:]+:[^@\s]+$/;
const DID_BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** OpenRouter format guard. */
export function validateOpenRouter(key: string): ValidatorResult {
  const trimmed = sanitizeCredential(key);
  if (trimmed.length < MIN_LENGTH) return shortFail();
  if (!OPENROUTER_RE.test(trimmed)) {
    return { ok: false, errorKey: 'byok.validate.openrouter.format' };
  }
  return { ok: true };
}

/** Anthropic format guard. */
export function validateAnthropic(key: string): ValidatorResult {
  const trimmed = sanitizeCredential(key);
  if (trimmed.length < MIN_LENGTH) return shortFail();
  if (!ANTHROPIC_RE.test(trimmed)) {
    return { ok: false, errorKey: 'byok.validate.anthropic.format' };
  }
  return { ok: true };
}

/** ElevenLabs xi-api-key guard. */
export function validateElevenLabs(key: string): ValidatorResult {
  const trimmed = sanitizeCredential(key);
  if (trimmed.length < MIN_LENGTH) return shortFail();
  if (!ELEVENLABS_RE.test(trimmed)) {
    return { ok: false, errorKey: 'byok.validate.elevenlabs.format' };
  }
  return { ok: true };
}

/**
 * D-ID guard with auto-base64 for raw `email:password` paste.
 */
export function validateDID(key: string): ValidatorResult {
  const trimmed = sanitizeCredential(key);
  if (trimmed.length < MIN_LENGTH) return shortFail();
  if (DID_EMAIL_PASSWORD_RE.test(trimmed)) {
    const encoded = safeBase64(trimmed);
    if (encoded === trimmed) {
      return { ok: false, errorKey: 'byok.validate.did.format' };
    }
    return { ok: true, autoEncoded: encoded };
  }
  if (DID_BASE64_RE.test(trimmed)) return { ok: true };
  return { ok: false, errorKey: 'byok.validate.did.format' };
}

/** MuAPI 20+ char token. */
export function validateMuapi(key: string): ValidatorResult {
  const trimmed = sanitizeCredential(key);
  if (trimmed.length < MIN_LENGTH) return shortFail();
  if (!MUAPI_RE.test(trimmed)) {
    return { ok: false, errorKey: 'byok.validate.muapi.format' };
  }
  return { ok: true };
}

/** Apollo 20+ char token. */
export function validateApollo(key: string): ValidatorResult {
  const trimmed = sanitizeCredential(key);
  if (trimmed.length < MIN_LENGTH) return shortFail();
  if (!APOLLO_RE.test(trimmed)) {
    return { ok: false, errorKey: 'byok.validate.apollo.format' };
  }
  return { ok: true };
}

/** Hunter 20+ char token. */
export function validateHunter(key: string): ValidatorResult {
  const trimmed = sanitizeCredential(key);
  if (trimmed.length < MIN_LENGTH) return shortFail();
  if (!HUNTER_RE.test(trimmed)) {
    return { ok: false, errorKey: 'byok.validate.hunter.format' };
  }
  return { ok: true };
}

/** Replicate token: `r8_<32+>`. */
export function validateReplicate(key: string): ValidatorResult {
  const trimmed = sanitizeCredential(key);
  if (trimmed.length < MIN_LENGTH) return shortFail();
  if (!REPLICATE_RE.test(trimmed)) {
    return { ok: false, errorKey: 'byok.validate.replicate.format' };
  }
  return { ok: true };
}

/** fal.ai key: `key-<uuid>`. */
export function validateFalAI(key: string): ValidatorResult {
  const trimmed = sanitizeCredential(key);
  if (trimmed.length < MIN_LENGTH) return shortFail();
  if (!/^key-[A-Za-z0-9_-]+$/.test(trimmed)) {
    return { ok: false, errorKey: 'byok.validate.falai.format' };
  }
  return { ok: true };
}

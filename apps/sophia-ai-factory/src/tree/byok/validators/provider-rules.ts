/**
 * Provider-Specific Key Format Validation Rules
 * Layer: TREE (Business Logic)
 */

import { MIN_LENGTH, type ValidatorResult } from './types';
import { sanitizeCredential, safeBase64, shortFail } from './credential-sanitizer';

const OPENROUTER_RE = /^sk-or-[A-Za-z0-9_-]+$/;
const ANTHROPIC_RE = /^sk-ant-[A-Za-z0-9_-]+$/;
const ELEVENLABS_RE = /^[A-Za-z0-9_-]{20,}$/;
const MUAPI_RE = /^[A-Za-z0-9_-]{20,}$/;
const APOLLO_RE = /^[A-Za-z0-9_-]{20,}$/;
const HUNTER_RE = /^[A-Za-z0-9_-]{20,}$/;
const REPLICATE_RE = /^r8_[A-Za-z0-9_-]{32,}$/;
const HEYGEN_RE = /^[A-Za-z0-9+/=_-]{16,}$/;
const DID_EMAIL_PASSWORD_RE = /^[^@\s]+@[^@\s:]+\.[^@\s:]+:[^@\s]+$/;
const DID_BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function testRegex(key: string, regex: RegExp, errorKey: string): ValidatorResult {
  const trimmed = sanitizeCredential(key);
  if (trimmed.length < MIN_LENGTH) return shortFail();
  return regex.test(trimmed) ? { ok: true } : { ok: false, errorKey };
}

export function validateOpenRouter(key: string): ValidatorResult {
  return testRegex(key, OPENROUTER_RE, 'byok.validate.openrouter.format');
}

export function validateAnthropic(key: string): ValidatorResult {
  return testRegex(key, ANTHROPIC_RE, 'byok.validate.anthropic.format');
}

export function validateElevenLabs(key: string): ValidatorResult {
  return testRegex(key, ELEVENLABS_RE, 'byok.validate.elevenlabs.format');
}

export function validateDID(key: string): ValidatorResult {
  const trimmed = sanitizeCredential(key);
  if (trimmed.length < MIN_LENGTH) return shortFail();
  if (DID_EMAIL_PASSWORD_RE.test(trimmed)) {
    const encoded = safeBase64(trimmed);
    return encoded === trimmed ? { ok: false, errorKey: 'byok.validate.did.format' } : { ok: true, autoEncoded: encoded };
  }
  return DID_BASE64_RE.test(trimmed) ? { ok: true } : { ok: false, errorKey: 'byok.validate.did.format' };
}

export function validateMuapi(key: string): ValidatorResult {
  return testRegex(key, MUAPI_RE, 'byok.validate.muapi.format');
}

export function validateApollo(key: string): ValidatorResult {
  return testRegex(key, APOLLO_RE, 'byok.validate.apollo.format');
}

export function validateHunter(key: string): ValidatorResult {
  return testRegex(key, HUNTER_RE, 'byok.validate.hunter.format');
}

export function validateReplicate(key: string): ValidatorResult {
  return testRegex(key, REPLICATE_RE, 'byok.validate.replicate.format');
}

export function validateFalAI(key: string): ValidatorResult {
  return testRegex(key, /^key-[A-Za-z0-9_-]+$/, 'byok.validate.falai.format');
}

export function validateHeyGen(key: string): ValidatorResult {
  return testRegex(key, HEYGEN_RE, 'byok.validate.heygen.format');
}

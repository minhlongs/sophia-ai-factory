/**
 * Credential Sanitization and Base64 Utilities
 * Layer: TREE (Business Logic)
 */

import type { ValidatorResult } from './types';

const ZERO_WIDTH_AND_BOM_RE = new RegExp('[\\u200B-\\u200D\\uFEFF]', 'g');
const CONTROL_CHARS_RE = /[\x00-\x1F\x7F-\x9F]/g;

/**
 * Strips all control characters (ASCII 0-31, 127), C1 controls (80-9F),
 * zero-width spaces (u200B-u200D), and BOM (uFEFF), then trims leading
 * and trailing whitespace (including Unicode whitespaces like non-breaking space).
 */
export function sanitizeCredential(value: string): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(ZERO_WIDTH_AND_BOM_RE, '')
    .replace(CONTROL_CHARS_RE, '')
    .trim();
}

/**
 * Base64-encode using browser-safe btoa when available, Buffer fallback for tests.
 * Returns the value as-is if encoding fails (caller falls back to "invalid").
 */
export function safeBase64(value: string): string {
  try {
    if (typeof btoa === 'function') return btoa(value);
    // Node.js fallback (Vitest env)
    return Buffer.from(value, 'utf-8').toString('base64');
  } catch {
    return value;
  }
}

export function shortFail(): ValidatorResult {
  return { ok: false, errorKey: 'byok.validate.too_short' };
}

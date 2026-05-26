/**
 * Tests for BYOK key format validators — Phase 03 acquisition-push.
 *
 * Covers: per-provider valid/invalid format, length floor (10 chars),
 * D-ID auto-base64 round-trip + raw-base64 acceptance, provider-agnostic
 * dispatcher fallback.
 */

import { describe, it, expect } from 'vitest'
import {
  validateOpenRouter,
  validateAnthropic,
  validateElevenLabs,
  validateDID,
  validateMuapi,
  validateApollo,
  validateHunter,
  validateProviderKey,
  sanitizeCredential,
} from './key-format-validators'

describe('validateOpenRouter', () => {
  it('accepts well-formed sk-or- prefixed keys', () => {
    expect(validateOpenRouter('sk-or-v1-' + 'a'.repeat(64)).ok).toBe(true)
    expect(validateOpenRouter('sk-or-v2-' + 'b'.repeat(64)).ok).toBe(true)
  })

  it('rejects keys without sk-or- prefix', () => {
    const result = validateOpenRouter('sk-something-else-1234567890')
    expect(result.ok).toBe(false)
    expect(result.errorKey).toBe('byok.validate.openrouter.format')
  })

  it('rejects too-short keys with too_short error', () => {
    const result = validateOpenRouter('sk-or-')
    expect(result.ok).toBe(false)
    expect(result.errorKey).toBe('byok.validate.too_short')
  })

  it('trims whitespace before evaluating', () => {
    expect(validateOpenRouter('  sk-or-v1-abcdefghij  ').ok).toBe(true)
  })
})

describe('validateAnthropic', () => {
  it('accepts sk-ant- prefixed keys', () => {
    expect(validateAnthropic('sk-ant-api03-' + 'x'.repeat(80)).ok).toBe(true)
    expect(validateAnthropic('sk-ant-api04-' + 'y'.repeat(80)).ok).toBe(true)
  })

  it('rejects without sk-ant- prefix', () => {
    const result = validateAnthropic('claude-key-1234567890')
    expect(result.ok).toBe(false)
    expect(result.errorKey).toBe('byok.validate.anthropic.format')
  })
})

describe('validateElevenLabs', () => {
  it('accepts 20+ char alphanumeric+_-', () => {
    expect(validateElevenLabs('abcdefghij_klmnopqrstuv').ok).toBe(true)
  })

  it('accepts sk_ prefixed long tokens', () => {
    expect(validateElevenLabs('sk_' + 'a'.repeat(32)).ok).toBe(true)
  })

  it('rejects keys with spaces or special chars', () => {
    const result = validateElevenLabs('has spaces 1234567890')
    expect(result.ok).toBe(false)
    expect(result.errorKey).toBe('byok.validate.elevenlabs.format')
  })

  it('rejects too-short tokens', () => {
    expect(validateElevenLabs('short').errorKey).toBe('byok.validate.too_short')
    expect(validateElevenLabs('1234567890123').errorKey).toBe('byok.validate.elevenlabs.format')
  })
})

describe('validateDID', () => {
  it('accepts properly base64-encoded key', () => {
    // Pre-encoded "user@example.com:secret123"
    const encoded = 'dXNlckBleGFtcGxlLmNvbTpzZWNyZXQxMjM='
    expect(validateDID(encoded).ok).toBe(true)
  })

  it('auto-base64 encodes raw email:password input', () => {
    const result = validateDID('user@example.com:secret123')
    expect(result.ok).toBe(true)
    expect(result.autoEncoded).toBeDefined()
    // Round-trip check
    expect(Buffer.from(result.autoEncoded!, 'base64').toString('utf-8')).toBe('user@example.com:secret123')
  })

  it('rejects email-only (missing password)', () => {
    const result = validateDID('user@example.com:')  // password empty
    expect(result.ok).toBe(false)
    expect(result.errorKey).toBe('byok.validate.did.format')
  })

  it('rejects plain text with no @ or : structure', () => {
    const result = validateDID('plain-text-token-1234567890')
    expect(result.ok).toBe(false)
    expect(result.errorKey).toBe('byok.validate.did.format')
  })

  it('rejects too-short input', () => {
    expect(validateDID('a:b').errorKey).toBe('byok.validate.too_short')
  })

  it('handles base64 with padding', () => {
    expect(validateDID('YWJjZGVmZ2hpams=').ok).toBe(true) // "abcdefghijk"
  })
})

describe('validateMuapi', () => {
  it('accepts 20+ char alphanumeric tokens', () => {
    expect(validateMuapi('mu-token-abcdefghij1234567890').ok).toBe(true)
  })

  it('rejects too-short', () => {
    expect(validateMuapi('mu-12').errorKey).toBe('byok.validate.too_short')
  })

  it('rejects invalid characters', () => {
    expect(validateMuapi('has spaces here 12345').errorKey).toBe('byok.validate.muapi.format')
  })
})

describe('validateApollo', () => {
  it('accepts 20+ char alphanumeric tokens', () => {
    expect(validateApollo('apollo-key-1234567890abcdef').ok).toBe(true)
  })

  it('rejects too-short', () => {
    expect(validateApollo('apo-12').errorKey).toBe('byok.validate.too_short')
  })

  it('rejects invalid characters', () => {
    expect(validateApollo('has spaces here 12345').errorKey).toBe('byok.validate.apollo.format')
  })
})

describe('validateHunter', () => {
  it('accepts 20+ char alphanumeric tokens', () => {
    expect(validateHunter('hunter-key-1234567890abcdef').ok).toBe(true)
  })

  it('rejects too-short', () => {
    expect(validateHunter('hunt-12').errorKey).toBe('byok.validate.too_short')
  })

  it('rejects invalid characters', () => {
    expect(validateHunter('has spaces here 12345').errorKey).toBe('byok.validate.hunter.format')
  })
})

describe('validateProviderKey dispatcher', () => {
  it('routes to openrouter validator', () => {
    expect(validateProviderKey('openrouter', 'sk-or-v1-abcdefghij').ok).toBe(true)
  })

  it('routes to d-id with auto-encode', () => {
    const result = validateProviderKey('d-id', 'user@example.com:pass1234')
    expect(result.ok).toBe(true)
    expect(result.autoEncoded).toBeDefined()
  })

  it('routes to apollo validator', () => {
    expect(validateProviderKey('apollo', 'apollo-key-1234567890abcdef').ok).toBe(true)
  })

  it('routes to hunter validator', () => {
    expect(validateProviderKey('hunter', 'hunter-key-1234567890abcdef').ok).toBe(true)
  })

  it('returns too_short for any provider when length < 10', () => {
    expect(validateProviderKey('elevenlabs', 'short').errorKey).toBe('byok.validate.too_short')
  })

  it('falls back to length-only for unknown provider (forward-compat)', () => {
    // @ts-expect-error — intentionally passing unknown provider
    const result = validateProviderKey('future-provider', 'long-enough-key-1234567890')
    expect(result.ok).toBe(true)
  })
})

describe('sanitizeCredential', () => {
  it('trims leading and trailing spaces and tabs', () => {
    expect(sanitizeCredential('  \tkey-value-123456\t  ')).toBe('key-value-123456')
  })

  it('strips newlines inside and around the key', () => {
    expect(sanitizeCredential('\nkey-value\r\n-123456\n')).toBe('key-value-123456')
  })

  it('strips zero-width characters and BOM', () => {
    expect(sanitizeCredential('key\u200B-value\uFEFF-1234\u200C56')).toBe('key-value-123456')
  })

  it('strips control characters', () => {
    expect(sanitizeCredential('key-\x00value\x0F-1234\x1F56')).toBe('key-value-123456')
  })
})

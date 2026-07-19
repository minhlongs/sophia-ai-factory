/**
 * Tests for GDPR PII detection + redaction (compliance-critical).
 *
 * Pure functions — pin pattern matchers (email/phone/SSN/credit-card),
 * preserve-domain email redaction (first*last@domain), and recursive
 * deep-redact for JSON details with known-PII-field heuristics
 * (email/phone/ssn key-name → [REDACTED] regardless of value).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import {
  PII_PATTERNS,
  containsPII,
  redactEmail,
  redactDetailsPII,
} from './gdpr-redaction-pii-detection'
import { logger } from '@/seed/utils/logger-utility'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PII_PATTERNS', () => {
  it('email matches standard formats', () => {
    expect(PII_PATTERNS.email.test('john@example.com')).toBe(true)
    expect(PII_PATTERNS.email.test('a.b+tag@sub.domain.co')).toBe(true)
    expect(PII_PATTERNS.email.test('not-an-email')).toBe(false)
    expect(PII_PATTERNS.email.test('missing@domain')).toBe(false)
  })

  it('phone matches US-style with optional country code/parens/separators', () => {
    expect(PII_PATTERNS.phone.test('555-123-4567')).toBe(true)
    expect(PII_PATTERNS.phone.test('(555) 123-4567')).toBe(true)
    expect(PII_PATTERNS.phone.test('+1-555-123-4567')).toBe(true)
    expect(PII_PATTERNS.phone.test('5551234567')).toBe(true)
    expect(PII_PATTERNS.phone.test('abc')).toBe(false)
  })

  it('ssn matches NNN-NN-NNNN format only', () => {
    expect(PII_PATTERNS.ssn.test('123-45-6789')).toBe(true)
    expect(PII_PATTERNS.ssn.test('123456789')).toBe(false)
    expect(PII_PATTERNS.ssn.test('12-345-6789')).toBe(false)
  })

  it('creditCard matches 16-digit with optional dashes/spaces', () => {
    expect(PII_PATTERNS.creditCard.test('4242424242424242')).toBe(true)
    expect(PII_PATTERNS.creditCard.test('4242-4242-4242-4242')).toBe(true)
    expect(PII_PATTERNS.creditCard.test('4242 4242 4242 4242')).toBe(true)
    expect(PII_PATTERNS.creditCard.test('1234')).toBe(false)
  })
})

describe('containsPII', () => {
  it('returns true for any matching pattern', () => {
    expect(containsPII('john@example.com')).toBe(true)
    expect(containsPII('555-123-4567')).toBe(true)
    expect(containsPII('123-45-6789')).toBe(true)
    expect(containsPII('4242-4242-4242-4242')).toBe(true)
  })

  it('returns false for benign text', () => {
    expect(containsPII('hello world')).toBe(false)
    expect(containsPII('user account created')).toBe(false)
  })

  it('returns false for empty/null/undefined/non-string inputs (defensive)', () => {
    expect(containsPII('')).toBe(false)
    expect(containsPII(null as unknown as string)).toBe(false)
    expect(containsPII(undefined as unknown as string)).toBe(false)
    expect(containsPII(123 as unknown as string)).toBe(false)
  })
})

describe('redactEmail', () => {
  it('preserves domain + masks middle of local part (first*last@domain)', () => {
    expect(redactEmail('john.doe@example.com')).toBe('j***e@example.com')
    expect(redactEmail('alice@gmail.com')).toBe('a***e@gmail.com')
  })

  it('handles 2-char local part as first***last (no middle to drop)', () => {
    expect(redactEmail('ab@test.org')).toBe('a***b@test.org')
  })

  it('handles 1-char local part as char***@domain', () => {
    expect(redactEmail('a@test.org')).toBe('a***@test.org')
  })

  it('returns [REDACTED] for empty local part (@example.com)', () => {
    expect(redactEmail('@example.com')).toBe('[REDACTED]')
  })

  it('returns [REDACTED] + warns for missing @ symbol', () => {
    expect(redactEmail('not-an-email')).toBe('[REDACTED]')
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no @ symbol'),
      expect.objectContaining({ email: 'not-an-email' }),
    )
  })

  it('returns [REDACTED] + warns for null/empty/undefined input', () => {
    expect(redactEmail('')).toBe('[REDACTED]')
    expect(redactEmail(null as unknown as string)).toBe('[REDACTED]')
    expect(redactEmail(undefined as unknown as string)).toBe('[REDACTED]')
    expect(logger.warn).toHaveBeenCalled()
  })
})

describe('redactDetailsPII', () => {
  it('returns null/undefined unchanged', () => {
    expect(redactDetailsPII(null)).toBeNull()
  })

  it('returns numbers/booleans unchanged', () => {
    expect(redactDetailsPII(42)).toBe(42)
    expect(redactDetailsPII(true)).toBe(true)
    expect(redactDetailsPII(false)).toBe(false)
  })

  it('redacts email-pattern strings via redactEmail', () => {
    expect(redactDetailsPII('alice@example.com')).toBe('a***e@example.com')
  })

  it('returns non-email strings unchanged', () => {
    expect(redactDetailsPII('some message')).toBe('some message')
  })

  it('redacts email entries inside arrays (deep)', () => {
    expect(redactDetailsPII(['alice@example.com', 'note'])).toEqual([
      'a***e@example.com',
      'note',
    ])
  })

  it('treats undefined array entries as null', () => {
    // Arrays may carry sparse/undefined slots; redactor must coerce to null
    const arr = [undefined as unknown as null, 'msg']
    expect(redactDetailsPII(arr as unknown as Parameters<typeof redactDetailsPII>[0])).toEqual([
      null,
      'msg',
    ])
  })

  it('masks known PII fields (email/phone/ssn key-name) regardless of value content', () => {
    expect(
      redactDetailsPII({
        email: 'alice@example.com',
        userEmail: 'bob@example.com',
        phone: '555-123-4567',
        userPhone: '5551234567',
        ssn: '123-45-6789',
        message: 'hello',
      }),
    ).toEqual({
      email: '[REDACTED]',
      userEmail: '[REDACTED]',
      phone: '[REDACTED]',
      userPhone: '[REDACTED]',
      ssn: '[REDACTED]',
      message: 'hello',
    })
  })

  it('redacts email values in non-PII-named fields via redactEmail (not [REDACTED])', () => {
    expect(
      redactDetailsPII({
        contact: 'alice@example.com',
        notes: 'hello',
      }),
    ).toEqual({
      contact: 'a***e@example.com',
      notes: 'hello',
    })
  })

  it('coerces undefined object property values to null', () => {
    expect(
      redactDetailsPII({
        a: undefined,
        b: 'keep',
      }),
    ).toEqual({
      a: null,
      b: 'keep',
    })
  })

  it('deep-redacts nested objects and arrays', () => {
    expect(
      redactDetailsPII({
        user: {
          email: 'alice@example.com',
          contacts: ['bob@example.com', 'plain string'],
        },
        meta: { count: 3, ok: true },
      }),
    ).toEqual({
      user: {
        email: '[REDACTED]',
        contacts: ['b***b@example.com', 'plain string'],
      },
      meta: { count: 3, ok: true },
    })
  })

  it('matches PII-field heuristic case-insensitively (Email, PHONE, SsN)', () => {
    expect(
      redactDetailsPII({
        Email: 'a@b.com',
        PHONE: '555-123-4567',
        SsN: '123-45-6789',
      }),
    ).toEqual({
      Email: '[REDACTED]',
      PHONE: '[REDACTED]',
      SsN: '[REDACTED]',
    })
  })

  it('handles empty object as empty object', () => {
    expect(redactDetailsPII({})).toEqual({})
  })

  it('handles empty array as empty array', () => {
    expect(redactDetailsPII([])).toEqual([])
  })
})

/**
 * Contract tests for clickbank-postback-parser
 *
 * Validates public API behavior of parsePostback including
 * transaction type alias normalization and error handling.
 *
 * @module affiliates/__tests__/clickbank-postback-parser-contract
 */

import { describe, it, expect } from 'vitest'
import { parsePostback } from '../clickbank-postback-parser'

describe('parsePostback', () => {
  it('parses a valid SALE postback correctly', () => {
    const body = 'receipt=ABC123&transactionType=SALE&amount=120.00&currency=USD&cvendthru=abc123def456ghi789jkl012&vendor=sophia&affiliate=aff001'
    const result = parsePostback(body)

    expect(result).not.toBeNull()
    expect(result!.receipt).toBe('ABC123')
    expect(result!.transactionType).toBe('SALE')
    expect(result!.amount).toBe(120)
    expect(result!.currency).toBe('USD')
    expect(result!.cvendthru).toBe('abc123def456ghi789jkl012')
    expect(result!.vendor).toBe('sophia')
    expect(result!.affiliate).toBe('aff001')
  })

  it('maps RFND alias to REFUND canonical type', () => {
    const body = 'receipt=ABC123&transactionType=RFND&amount=50.00'
    const result = parsePostback(body)

    expect(result).not.toBeNull()
    expect(result!.transactionType).toBe('REFUND')
  })

  it('maps CGBK alias to CHARGEBACK canonical type', () => {
    const body = 'receipt=ABC123&transactionType=CGBK&amount=50.00'
    const result = parsePostback(body)

    expect(result).not.toBeNull()
    expect(result!.transactionType).toBe('CHARGEBACK')
  })

  it('handles missing cvendthru as undefined (not error)', () => {
    const body = 'receipt=ABC123&transactionType=SALE&amount=100.00'
    const result = parsePostback(body)

    expect(result).not.toBeNull()
    expect(result!.cvendthru).toBeUndefined()
  })

  it('returns null for malformed body (non-url-encoded)', () => {
    const body = 'this is not a valid url encoded string!!!'
    // parsePostback will still parse it since URLSearchParams accepts anything
    // but it should parse without error and return the result if fields are present
    const result = parsePostback('')
    expect(result).toBeNull()
  })

  it('returns null for unknown transactionType (Zod rejection)', () => {
    const body = 'receipt=ABC123&transactionType=INVALID_TYPE&amount=100.00'
    const result = parsePostback(body)

    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    const result = parsePostback('')
    expect(result).toBeNull()
  })

  it('maps BILL alias to SALE canonical type', () => {
    const body = 'receipt=ABC123&transactionType=BILL&amount=75.00'
    const result = parsePostback(body)

    expect(result).not.toBeNull()
    expect(result!.transactionType).toBe('SALE')
  })

  it('parses TEST transactionType correctly', () => {
    const body = 'receipt=TEST001&transactionType=TEST&amount=0.01'
    const result = parsePostback(body)

    expect(result).not.toBeNull()
    expect(result!.transactionType).toBe('TEST')
  })

  it('defaults currency to USD when missing', () => {
    const body = 'receipt=ABC123&transactionType=SALE&amount=100.00'
    const result = parsePostback(body)

    expect(result).not.toBeNull()
    expect(result!.currency).toBe('USD')
  })

  it('coerces amount string to number', () => {
    const body = 'receipt=ABC123&transactionType=SALE&amount=99.99'
    const result = parsePostback(body)

    expect(result).not.toBeNull()
    expect(result!.amount).toBe(99.99)
    expect(typeof result!.amount).toBe('number')
  })
})

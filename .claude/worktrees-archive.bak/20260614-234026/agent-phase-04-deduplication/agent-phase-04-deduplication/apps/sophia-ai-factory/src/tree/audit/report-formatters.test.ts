/**
 * Tests for report-formatters (CSV + JSON + bytes helpers).
 *
 * Pure functions. Pins CSV RFC 4180 escape rules (quote on comma/quote/newline,
 * double-up internal quotes), JSON pretty-print indent=2, byte formatting
 * with binary (1024) units.
 */

import { describe, it, expect } from 'vitest'
import {
  generateUsageCSV,
  generateComplianceJSON,
  formatBytes,
} from './report-formatters'
import type { ReportFilters } from './report-scheduler'
import type { ComplianceReportData } from './report-types'

const stubFilters: ReportFilters = {} as ReportFilters

function makeRow(over: Partial<Parameters<typeof generateUsageCSV>[0][number]> = {}) {
  return {
    timestamp: '2026-05-11T00:00:00Z',
    licenseNonce: 'nonce-1',
    modelName: 'gpt-4o',
    tokenCount: 100,
    tokensInput: 60,
    tokensOutput: 40,
    tier: 'PREMIUM',
    ...over,
  }
}

describe('generateUsageCSV', () => {
  it('emits headers as first line', () => {
    const csv = generateUsageCSV([], stubFilters)
    expect(csv).toBe('Timestamp,License Nonce,Model Name,Token Count,Input Tokens,Output Tokens,Tier')
  })

  it('appends rows after header (newline separator)', () => {
    const csv = generateUsageCSV([makeRow()], stubFilters)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toBe('2026-05-11T00:00:00Z,nonce-1,gpt-4o,100,60,40,PREMIUM')
  })

  it('quotes values containing commas (RFC 4180)', () => {
    const csv = generateUsageCSV([makeRow({ modelName: 'gpt-4o, vision' })], stubFilters)
    expect(csv.split('\n')[1]).toContain('"gpt-4o, vision"')
  })

  it('quotes values containing newlines (embedded \\n preserved inside quotes)', () => {
    const csv = generateUsageCSV([makeRow({ licenseNonce: 'line1\nline2' })], stubFilters)
    // Cannot split on \n — embedded newline is inside quoted field
    expect(csv).toContain('"line1\nline2"')
  })

  it('escapes internal quotes by doubling them ("" inside quoted field)', () => {
    const csv = generateUsageCSV([makeRow({ modelName: 'model "v2"' })], stubFilters)
    expect(csv.split('\n')[1]).toContain('"model ""v2"""')
  })

  it('does NOT quote benign values (no comma/quote/newline)', () => {
    const csv = generateUsageCSV([makeRow({ tier: 'PREMIUM' })], stubFilters)
    expect(csv.split('\n')[1]).not.toContain('"PREMIUM"')
  })

  it('stringifies numbers via String() (no quoting unless special chars)', () => {
    const csv = generateUsageCSV([makeRow({ tokenCount: 12345 })], stubFilters)
    expect(csv.split('\n')[1]).toContain(',12345,')
  })

  it('handles empty data array (header-only output)', () => {
    expect(generateUsageCSV([], stubFilters).split('\n')).toHaveLength(1)
  })

  it('handles multi-row data with mixed escaping', () => {
    const csv = generateUsageCSV(
      [
        makeRow({ modelName: 'simple' }),
        makeRow({ modelName: 'has, comma' }),
        makeRow({ modelName: 'has "quote"' }),
      ],
      stubFilters,
    )
    const lines = csv.split('\n')
    expect(lines).toHaveLength(4)
    expect(lines[1]).toContain('simple')
    expect(lines[2]).toContain('"has, comma"')
    expect(lines[3]).toContain('"has ""quote"""')
  })
})

describe('generateComplianceJSON', () => {
  it('returns 2-space-indented JSON', () => {
    const data = { foo: { bar: 1 } } as unknown as ComplianceReportData
    const json = generateComplianceJSON(data)
    expect(json).toContain('  "foo": {')
    expect(json).toContain('    "bar": 1')
  })

  it('is parseable back to original object (round-trip)', () => {
    const data = { a: 1, b: ['x', 'y'], c: { nested: true } } as unknown as ComplianceReportData
    expect(JSON.parse(generateComplianceJSON(data))).toEqual(data)
  })
})

describe('formatBytes', () => {
  it('returns "0 B" for zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats sub-KB values as B', () => {
    expect(formatBytes(500)).toBe('500 B')
  })

  it('formats KB with binary 1024 base', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(2048)).toBe('2 KB')
  })

  it('formats MB at 1024² boundary', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
  })

  it('formats GB at 1024³ boundary', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
  })

  it('rounds fractional values to 2 decimal places (parseFloat strips trailing zeros)', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1500)).toBe('1.46 KB')
  })

  it('handles values just below boundaries (no premature unit promotion)', () => {
    expect(formatBytes(1023)).toBe('1023 B')
    expect(formatBytes(1024 * 1024 - 1)).toBe('1024 KB') // floor → KB
  })
})

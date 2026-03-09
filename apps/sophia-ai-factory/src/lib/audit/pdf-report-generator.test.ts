/**
 * PDF Report Generator Tests
 */

import { describe, it, expect } from 'vitest'
import {
  generateComplianceHTML,
  generateUsageCSV,
  generateComplianceJSON,
  generateReport,
  formatBytes,
  type ComplianceReportData
} from './pdf-report-generator'

const mockReportData: ComplianceReportData = {
  reportId: 'test-report-uuid',
  generatedAt: '2026-03-08T12:00:00.000Z',
  generatedBy: 'admin',
  period: {
    start: new Date('2026-03-01T00:00:00.000Z'),
    end: new Date('2026-03-31T23:59:59.000Z')
  },
  summary: {
    totalLogs: 1500,
    hashChainValid: true,
    totalLicenses: 25,
    totalUsage: 10000,
    periodStart: new Date('2026-03-01T00:00:00.000Z'),
    periodEnd: new Date('2026-03-31T23:59:59.000Z')
  },
  licenses: [
    {
      nonce: 'abc123-def456-ghi789',
      tier: 'PREMIUM',
      validationCount: 500,
      usageCredits: 50000,
      createdAt: '2026-03-01T10:00:00.000Z'
    },
    {
      nonce: 'jkl012-mno345-pqr678',
      tier: 'ENTERPRISE',
      validationCount: 1000,
      usageCredits: 100000,
      createdAt: '2026-03-05T14:30:00.000Z'
    }
  ],
  modelBreakdown: [
    {
      modelName: 'gpt-4',
      invocations: 5000,
      tokensProcessed: 7500000,
      tokensInput: 5000000,
      tokensOutput: 2500000
    },
    {
      modelName: 'claude-3',
      invocations: 5000,
      tokensProcessed: 8000000,
      tokensInput: 5500000,
      tokensOutput: 2500000
    }
  ],
  hashChainVerification: {
    firstHash: 'a1b2c3d4e5f6...',
    lastHash: 'x7y8z9w0v1u2...',
    totalLogs: 1500,
    verified: true
  }
}

describe('generateComplianceHTML', () => {
  it('generates valid HTML document', () => {
    const html = generateComplianceHTML(mockReportData)

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('</html>')
    expect(html).toContain('Compliance Report')
    expect(html).toContain('test-report-uuid')
  })

  it('includes executive summary section', () => {
    const html = generateComplianceHTML(mockReportData)

    expect(html).toContain('Executive Summary')
    expect(html).toContain('1,500') // totalLogs formatted
    expect(html).toContain('25') // totalLicenses
    expect(html).toContain('10,000') // totalUsage
  })

  it('includes hash chain verification section', () => {
    const html = generateComplianceHTML(mockReportData)

    expect(html).toContain('Hash Chain Verification')
    expect(html).toContain('✓ Verified')
    expect(html).toContain('a1b2c3d4e5f6...')
  })

  it('includes license breakdown table', () => {
    const html = generateComplianceHTML(mockReportData)

    expect(html).toContain('License Breakdown')
    expect(html).toContain('abc123-def456-ghi789'.slice(0, 12)) // Truncated to first 12 chars
    expect(html).toContain('PREMIUM')
    expect(html).toContain('ENTERPRISE')
  })

  it('includes model usage breakdown table', () => {
    const html = generateComplianceHTML(mockReportData)

    expect(html).toContain('Model Usage Breakdown')
    expect(html).toContain('gpt-4')
    expect(html).toContain('claude-3')
    expect(html).toContain('7,500,000') // tokensProcessed formatted
  })

  it('handles empty license data gracefully', () => {
    const dataWithNoLicenses = {
      ...mockReportData,
      licenses: []
    }

    const html = generateComplianceHTML(dataWithNoLicenses)
    expect(html).toContain('No license data available')
  })

  it('handles empty model breakdown gracefully', () => {
    const dataWithNoModels = {
      ...mockReportData,
      modelBreakdown: []
    }

    const html = generateComplianceHTML(dataWithNoModels)
    expect(html).toContain('No usage data available')
  })

  it('shows hash chain invalid status when verified is false', () => {
    const dataWithInvalidHash = {
      ...mockReportData,
      hashChainVerification: {
        ...mockReportData.hashChainVerification,
        verified: false,
        invalidIndex: 42
      }
    }

    const html = generateComplianceHTML(dataWithInvalidHash)
    expect(html).toContain('✗ Broken at index 42')
  })
})

describe('generateUsageCSV', () => {
  const mockUsageData = [
    {
      timestamp: '2026-03-08T10:00:00.000Z',
      licenseNonce: 'abc123',
      modelName: 'gpt-4',
      tokenCount: 1500,
      tokensInput: 1000,
      tokensOutput: 500,
      tier: 'PREMIUM'
    },
    {
      timestamp: '2026-03-08T11:00:00.000Z',
      licenseNonce: 'def456',
      modelName: 'claude-3',
      tokenCount: 2000,
      tokensInput: 1500,
      tokensOutput: 500,
      tier: 'ENTERPRISE'
    }
  ]

  it('generates CSV with correct headers', () => {
    const csv = generateUsageCSV(mockUsageData, {})

    expect(csv).toContain('Timestamp,License Nonce,Model Name,Token Count,Input Tokens,Output Tokens,Tier')
  })

  it('generates CSV rows for each record', () => {
    const csv = generateUsageCSV(mockUsageData, {})

    const lines = csv.split('\n')
    expect(lines.length).toBe(3) // header + 2 data rows
    expect(lines[1]).toContain('gpt-4')
    expect(lines[2]).toContain('claude-3')
  })

  it('escapes values with commas correctly', () => {
    const dataWithCommas = [
      {
        timestamp: '2026-03-08T10:00:00.000Z',
        licenseNonce: 'abc,123',
        modelName: 'gpt-4, turbo',
        tokenCount: 1500,
        tokensInput: 1000,
        tokensOutput: 500,
        tier: 'PREMIUM'
      }
    ]

    const csv = generateUsageCSV(dataWithCommas, {})
    expect(csv).toContain('"abc,123"')
    expect(csv).toContain('"gpt-4, turbo"')
  })

  it('escapes values with quotes correctly', () => {
    const dataWithQuotes = [
      {
        timestamp: '2026-03-08T10:00:00.000Z',
        licenseNonce: 'abc"123',
        modelName: 'gpt-4',
        tokenCount: 1500,
        tokensInput: 1000,
        tokensOutput: 500,
        tier: 'PREMIUM'
      }
    ]

    const csv = generateUsageCSV(dataWithQuotes, {})
    expect(csv).toContain('"abc""123"')
  })

  it('handles empty data array', () => {
    const csv = generateUsageCSV([], {})
    const lines = csv.split('\n')
    expect(lines.length).toBe(1) // header only
    expect(lines[0]).toContain('Timestamp')
  })
})

describe('generateComplianceJSON', () => {
  it('generates valid JSON string', () => {
    const json = generateComplianceJSON(mockReportData)

    const parsed = JSON.parse(json)
    expect(parsed.reportId).toBe('test-report-uuid')
    expect(parsed.summary.totalLogs).toBe(1500)
    expect(parsed.licenses.length).toBe(2)
  })

  it('pretty-prints JSON with 2-space indentation', () => {
    const json = generateComplianceJSON(mockReportData)

    // Check for 2-space indentation
    expect(json).toContain('  "reportId"')
    expect(json).toContain('  "generatedAt"')
  })
})

describe('generateReport', () => {
  it('generates HTML for PDF format', () => {
    const result = generateReport(mockReportData, 'pdf')
    expect(result).toContain('<!DOCTYPE html>')
  })

  it('generates JSON for JSON format', () => {
    const result = generateReport(mockReportData, 'json')
    const parsed = JSON.parse(result)
    expect(parsed.reportId).toBe('test-report-uuid')
  })

  it('generates CSV for CSV format', () => {
    const result = generateReport(mockReportData, 'csv')
    expect(result).toContain('Timestamp,License Nonce,Model Name')
  })

  it('throws error for invalid format', () => {
    expect(() => generateReport(mockReportData, 'invalid' as any)).toThrow()
  })
})

describe('formatBytes', () => {
  it('formats zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes', () => {
    expect(formatBytes(1024)).toBe('1 KB')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(2048)).toBe('2 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1 MB')
  })

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1 GB')
  })

  it('formats partial units', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
  })
})

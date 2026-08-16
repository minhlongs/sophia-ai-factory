import type { ReportFilters } from '@/tree/audit/report-scheduler'
import type { ComplianceReportData } from '@/tree/audit/report-types'

/** Generate CSV for usage data */
export function generateUsageCSV(
  data: Array<{
    timestamp: string
    licenseNonce: string
    modelName: string
    tokenCount: number
    tokensInput: number
    tokensOutput: number
    tier: string
  }>,
  _filters: ReportFilters
): string {
  const headers = [
    'Timestamp',
    'License Nonce',
    'Model Name',
    'Token Count',
    'Input Tokens',
    'Output Tokens',
    'Tier'
  ]

  const escape = (value: string | number) => {
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const rows = data.map((row) =>
    [
      escape(row.timestamp),
      escape(row.licenseNonce),
      escape(row.modelName),
      escape(row.tokenCount),
      escape(row.tokensInput),
      escape(row.tokensOutput),
      escape(row.tier)
    ].join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}

/** Generate JSON report (pretty-printed) */
export function generateComplianceJSON(data: ComplianceReportData): string {
  return JSON.stringify(data, null, 2)
}

/** Format bytes to human-readable size */
export function formatBytes(bytes: number): string {
  const safe = Number(bytes)
  if (!Number.isFinite(safe) || safe <= 0) return '0 B'
  const clamped = Math.max(0, safe)
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'] as const
  const i = Math.min(Math.floor(Math.log(clamped) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((clamped / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

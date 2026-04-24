/**
 * Compliance Report Generator (PDF/CSV/JSON)
 *
 * Generates compliance reports in multiple formats:
 * - PDF: HTML-based report with professional styling
 * - CSV: Tabular data for spreadsheet analysis
 * - JSON: Machine-readable format for integration
 *
 * Note: For PDF generation, this module creates HTML templates.
 * To convert to PDF, use a service like Playwright or pdfkit externally.
 *
 * @module audit/pdf-report-generator
 */

import { logger } from '@/lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'
import type { ReportFilters } from './report-scheduler'

/**
 * License data for compliance reports
 */
export interface LicenseReportData {
  nonce: string
  tier: string
  validationCount: number
  usageCredits: number
  createdAt: string
  lastUsedAt?: string
}

/**
 * Model usage breakdown
 */
export interface ModelUsageData {
  modelName: string
  invocations: number
  tokensProcessed: number
  tokensInput: number
  tokensOutput: number
}

/**
 * Hash chain verification status
 */
export interface HashChainVerification {
  firstHash: string
  lastHash: string
  totalLogs: number
  verified: boolean
  invalidIndex?: number
}

/**
 * Compliance report summary
 */
export interface ComplianceReportSummary {
  totalLogs: number
  hashChainValid: boolean
  totalLicenses: number
  totalUsage: number
  periodStart: Date
  periodEnd: Date
}

/**
 * Complete compliance report data structure
 */
export interface ComplianceReportData {
  reportId: string
  generatedAt: string
  generatedBy: string
  period: { start: Date; end: Date }
  summary: ComplianceReportSummary
  licenses: LicenseReportData[]
  modelBreakdown: ModelUsageData[]
  hashChainVerification: HashChainVerification
  auditTrailUrl?: string
}

/**
 * Generate HTML template for compliance PDF report
 *
 * @param data - Compliance report data
 * @returns HTML string ready for PDF conversion
 */
export function generateComplianceHTML(data: ComplianceReportData): string {
  const { reportId, generatedAt, period, summary, licenses, modelBreakdown, hashChainVerification } = data

  // Format dates
  const formatDate = (date: Date) => date.toISOString().split('T')[0]
  const formatDateTime = (date: Date) => date.toISOString()

  // Generate license rows
  const licenseRows = licenses
    .map(
      (lic) => `
        <tr class="license-row">
          <td class="mono">${lic.nonce.slice(0, 12)}...</td>
          <td><span class="badge badge-${lic.tier.toLowerCase()}">${lic.tier}</span></td>
          <td class="num">${lic.validationCount.toLocaleString()}</td>
          <td class="num">${lic.usageCredits.toLocaleString()}</td>
          <td class="mono">${formatDate(new Date(lic.createdAt))}</td>
        </tr>
      `
    )
    .join('\n')

  // Generate model breakdown rows
  const modelRows = modelBreakdown
    .map(
      (model) => `
        <tr class="model-row">
          <td class="mono">${model.modelName}</td>
          <td class="num">${model.invocations.toLocaleString()}</td>
          <td class="num">${model.tokensProcessed.toLocaleString()}</td>
          <td class="num">${model.tokensInput.toLocaleString()}</td>
          <td class="num">${model.tokensOutput.toLocaleString()}</td>
        </tr>
      `
    )
    .join('\n')

  // Hash chain status
  const hashStatus = hashChainVerification.verified
    ? '<span class="status-ok">✓ Verified</span>'
    : `<span class="status-error">✗ Broken at index ${hashChainVerification.invalidIndex}</span>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compliance Report - ${reportId}</title>
  <style>
    :root {
      --primary: #1a1a2e;
      --secondary: #16213e;
      --accent: #0f3460;
      --success: #22c55e;
      --error: #ef4444;
      --warning: #f59e0b;
      --text: #1f2937;
      --text-muted: #6b7280;
      --bg: #ffffff;
      --border: #e5e7eb;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: var(--text);
      background: var(--bg);
      padding: 40px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      border-bottom: 3px solid var(--primary);
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 8px;
    }
    .report-meta {
      display: flex;
      gap: 24px;
      color: var(--text-muted);
      font-size: 14px;
    }
    .report-id { font-family: monospace; }
    section { margin-bottom: 40px; }
    h2 {
      font-size: 20px;
      font-weight: 600;
      color: var(--primary);
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .summary-card {
      background: var(--secondary);
      border-radius: 8px;
      padding: 20px;
      color: white;
    }
    .summary-card .value {
      font-size: 32px;
      font-weight: 700;
      display: block;
    }
    .summary-card .label {
      font-size: 13px;
      opacity: 0.8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      background: var(--secondary);
      color: white;
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    tr:hover { background: #f9fafb; }
    .mono { font-family: 'SF Mono', Monaco, monospace; font-size: 13px; }
    .num { text-align: right; }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-basic { background: #dbeafe; color: #1d4ed8; }
    .badge-premium { background: #fef3c7; color: #b45309; }
    .badge-enterprise { background: #dcfce7; color: #15803d; }
    .badge-master { background: #f3e8ff; color: #7c3aed; }
    .status-ok {
      color: var(--success);
      font-weight: 600;
    }
    .status-error {
      color: var(--error);
      font-weight: 600;
    }
    .hash-chain {
      background: var(--secondary);
      border-radius: 8px;
      padding: 20px;
      color: white;
      font-family: monospace;
      font-size: 12px;
      word-break: break-all;
    }
    .hash-chain .hash {
      margin-top: 8px;
      padding: 8px;
      background: rgba(255,255,255,0.1);
      border-radius: 4px;
    }
    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }
    @media print {
      body { padding: 20px; }
      .summary-card { break-inside: avoid; }
      table { break-inside: auto; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📊 Compliance Report</h1>
      <div class="report-meta">
        <span class="report-id">ID: ${reportId}</span>
        <span>Generated: ${formatDateTime(new Date(generatedAt))}</span>
        <span>Period: ${formatDate(period.start)} – ${formatDate(period.end)}</span>
      </div>
    </header>

    <section>
      <h2>Executive Summary</h2>
      <div class="summary-grid">
        <div class="summary-card">
          <span class="value">${summary.totalLogs.toLocaleString()}</span>
          <span class="label">Total Audit Logs</span>
        </div>
        <div class="summary-card" style="background: ${summary.hashChainValid ? 'var(--success)' : 'var(--error)'}">
          <span class="value">${summary.hashChainValid ? '✓' : '✗'}</span>
          <span class="label">Hash Chain Valid</span>
        </div>
        <div class="summary-card">
          <span class="value">${summary.totalLicenses.toLocaleString()}</span>
          <span class="label">Active Licenses</span>
        </div>
        <div class="summary-card">
          <span class="value">${summary.totalUsage.toLocaleString()}</span>
          <span class="label">API Invocations</span>
        </div>
      </div>
    </section>

    <section>
      <h2>Hash Chain Verification</h2>
      <div class="hash-chain">
        <div>Status: ${hashStatus}</div>
        <div class="hash">First: ${hashChainVerification.firstHash}</div>
        <div class="hash">Last: ${hashChainVerification.lastHash}</div>
        <div style="margin-top: 12px;">Total Logs Verified: ${hashChainVerification.totalLogs.toLocaleString()}</div>
      </div>
    </section>

    <section>
      <h2>License Breakdown</h2>
      <table>
        <thead>
          <tr>
            <th>License Nonce</th>
            <th>Tier</th>
            <th class="num">Validations</th>
            <th class="num">Usage Credits</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          ${licenseRows || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px;">No license data available</td></tr>'}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Model Usage Breakdown</h2>
      <table>
        <thead>
          <tr>
            <th>Model Name</th>
            <th class="num">Invocations</th>
            <th class="num">Total Tokens</th>
            <th class="num">Input Tokens</th>
            <th class="num">Output Tokens</th>
          </tr>
        </thead>
        <tbody>
          ${modelRows || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px;">No usage data available</td></tr>'}
        </tbody>
      </table>
    </section>

    <footer class="footer">
      <p>This report is generated automatically by Sophia AI Factory Compliance System.</p>
      <p>For verification, visit: ${data.auditTrailUrl || 'Admin Dashboard → Audit Logs'}</p>
      <p style="margin-top: 16px;">Report ID: <span class="mono">${reportId}</span></p>
    </footer>
  </div>
</body>
</html>`
}

/**
 * Generate CSV for usage data
 *
 * @param data - Array of usage records
 * @param filters - Report filters
 * @returns CSV string with headers
 */
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
  filters: ReportFilters
): string {
  // CSV headers
  const headers = [
    'Timestamp',
    'License Nonce',
    'Model Name',
    'Token Count',
    'Input Tokens',
    'Output Tokens',
    'Tier'
  ]

  // Escape CSV values (handle commas and quotes)
  const escape = (value: string | number) => {
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  // Build CSV rows
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

  // Combine headers and rows
  return [headers.join(','), ...rows].join('\n')
}

/**
 * Generate JSON report
 *
 * @param data - Compliance report data
 * @returns JSON string (pretty-printed)
 */
export function generateComplianceJSON(data: ComplianceReportData): string {
  return JSON.stringify(data, null, 2)
}

/**
 * Generate report in specified format
 *
 * @param data - Compliance report data
 * @param format - Output format (pdf | csv | json)
 * @returns Report content as string (HTML for PDF, CSV, or JSON)
 */
export function generateReport(
  data: ComplianceReportData,
  format: 'pdf' | 'csv' | 'json'
): string {
  try {
    switch (format) {
      case 'pdf':
        return generateComplianceHTML(data)
      case 'json':
        return generateComplianceJSON(data)
      case 'csv':
        // For CSV, extract usage data from model breakdown
        const usageData = data.modelBreakdown.map((model) => ({
          timestamp: data.generatedAt,
          licenseNonce: data.licenses[0]?.nonce || 'N/A',
          modelName: model.modelName,
          tokenCount: model.tokensProcessed,
          tokensInput: model.tokensInput,
          tokensOutput: model.tokensOutput,
          tier: data.licenses[0]?.tier || 'N/A'
        }))
        return generateUsageCSV(usageData, {
          startDate: data.period.start.getTime() / 1000,
          endDate: data.period.end.getTime() / 1000
        })
      default:
        throw new Error(`Invalid format: ${format}`)
    }
  } catch (error) {
    logger.error('[Report Generator] Generate report failed', toError(error))
    throw error
  }
}

/**
 * Generate summary statistics from audit data
 */
export interface ReportSummary {
  totalLogs: number
  hashChainValid: boolean
  totalLicenses: number
  totalUsage: number
  periodStart: Date
  periodEnd: Date
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

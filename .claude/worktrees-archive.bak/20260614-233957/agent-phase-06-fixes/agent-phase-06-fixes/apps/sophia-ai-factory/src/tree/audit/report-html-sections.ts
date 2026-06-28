/**
 * HTML section builders for compliance PDF report
 *
 * Each function renders a discrete section of the compliance report body.
 * No barrel imports — imports directly from sibling modules.
 */

import type { ComplianceReportData } from '@/tree/audit/report-types'

const formatDate = (date: Date) => date.toISOString().split('T')[0]
const formatDateTime = (date: Date) => date.toISOString()

/** Render license table rows */
function buildLicenseRows(licenses: ComplianceReportData['licenses']): string {
  return licenses
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
}

/** Render model breakdown table rows */
function buildModelRows(modelBreakdown: ComplianceReportData['modelBreakdown']): string {
  return modelBreakdown
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
}

/** Build full HTML body sections from report data */
export function buildReportSections(data: ComplianceReportData): {
  header: string
  summarySection: string
  hashChainSection: string
  licenseSection: string
  modelSection: string
  footer: string
} {
  const { reportId, generatedAt, period, summary, licenses, modelBreakdown, hashChainVerification } = data

  const hashStatus = hashChainVerification.verified
    ? '<span class="status-ok">✓ Verified</span>'
    : `<span class="status-error">✗ Broken at index ${hashChainVerification.invalidIndex}</span>`

  const licenseRows = buildLicenseRows(licenses)
  const modelRows = buildModelRows(modelBreakdown)

  return {
    header: `
    <header>
      <h1>📊 Compliance Report</h1>
      <div class="report-meta">
        <span class="report-id">ID: ${reportId}</span>
        <span>Generated: ${formatDateTime(new Date(generatedAt))}</span>
        <span>Period: ${formatDate(period.start)} – ${formatDate(period.end)}</span>
      </div>
    </header>`,

    summarySection: `
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
    </section>`,

    hashChainSection: `
    <section>
      <h2>Hash Chain Verification</h2>
      <div class="hash-chain">
        <div>Status: ${hashStatus}</div>
        <div class="hash">First: ${hashChainVerification.firstHash}</div>
        <div class="hash">Last: ${hashChainVerification.lastHash}</div>
        <div style="margin-top: 12px;">Total Logs Verified: ${hashChainVerification.totalLogs.toLocaleString()}</div>
      </div>
    </section>`,

    licenseSection: `
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
    </section>`,

    modelSection: `
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
    </section>`,

    footer: `
    <footer class="footer">
      <p>This report is generated automatically by Sophia AI Factory Compliance System.</p>
      <p>For verification, visit: ${data.auditTrailUrl || 'Admin Dashboard → Audit Logs'}</p>
      <p style="margin-top: 16px;">Report ID: <span class="mono">${reportId}</span></p>
    </footer>`,
  }
}

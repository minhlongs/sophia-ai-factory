import type { ComplianceReportData } from './report-types'

/** Generate HTML template for compliance PDF report */
export function generateComplianceHTML(data: ComplianceReportData): string {
  const { reportId, generatedAt, period, summary, licenses, modelBreakdown, hashChainVerification } = data

  const formatDate = (date: Date) => date.toISOString().split('T')[0]
  const formatDateTime = (date: Date) => date.toISOString()

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

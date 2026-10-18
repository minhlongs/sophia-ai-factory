import { REPORT_COMPONENT_STYLES } from './report-component-styles'

/** CSS styles for compliance PDF report HTML template */
export function getReportStyles(): string {
  return `
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
    .num { text-align: right; }${REPORT_COMPONENT_STYLES}`
}

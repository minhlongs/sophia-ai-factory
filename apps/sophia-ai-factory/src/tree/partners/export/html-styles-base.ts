/**
 * Base Page, Reset, Typography & Table Styles
 * Layer: tree/partners
 *
 * @module tree/partners/export/html-styles-base
 */

export function buildBaseHtmlStyles(primaryColor: string, accentColor: string): string {
  return `
    @page {
      size: A4 landscape;
      margin: 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    :root {
      --primary: ${primaryColor};
      --accent: ${accentColor};
      --bg: #ffffff;
      --card-bg: #f8fafc;
      --border: #e2e8f0;
      --text-main: #0f172a;
      --text-muted: #64748b;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 24px;
      color: var(--text-main);
      background: var(--bg);
      line-height: 1.4;
      font-size: 13px;
    }
    .no-print {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-bottom: 20px;
    }
    .print-btn {
      background: var(--primary);
      color: #ffffff;
      border: none;
      padding: 9px 18px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: opacity 0.2s ease;
    }
    .print-btn:hover {
      opacity: 0.9;
    }
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid var(--primary);
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand-container {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brand-logo {
      max-height: 44px;
      max-width: 180px;
      object-fit: contain;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: var(--text-main);
    }
    .report-subtitle {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
      font-weight: 500;
    }
    .meta-box {
      text-align: right;
    }
    .meta-period {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-main);
    }
    .meta-date {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .badge-tier {
      display: inline-block;
      background: #f1f5f9;
      color: #334155;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-bar {
      width: 4px;
      height: 16px;
      background: var(--primary);
      border-radius: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 12px;
    }
    th {
      background: #f1f5f9;
      padding: 9px 11px;
      text-align: left;
      font-weight: 700;
      color: #334155;
      border-bottom: 1px solid #cbd5e1;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    td {
      padding: 9px 11px;
      border-bottom: 1px solid var(--border);
      color: var(--text-main);
    }
    tr:nth-child(even) td {
      background-color: #fafbfc;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
  `;
}

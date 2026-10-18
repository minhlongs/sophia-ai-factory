/**
 * Table & Section Styles for Partner HTML Export
 * Layer: tree/partners
 *
 * @module tree/partners/export/html-styles-table
 */

export const HTML_TABLE_AND_SECTION_STYLES = `    .section-title {
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
    }`;

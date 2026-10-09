/**
 * KPI Grid, Badges, Heat Cells & Print Media Styles
 * Layer: tree/partners
 *
 * @module tree/partners/export/html-styles-kpi
 */

export function buildKpiAndPrintStyles(): string {
  return `
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 14px;
      margin-bottom: 26px;
    }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 12px;
      text-align: center;
      position: relative;
    }
    .kpi-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .kpi-value {
      font-size: 20px;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1.1;
    }
    .kpi-sub {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .spark-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .heat-cell {
      font-weight: 600;
      border-radius: 4px;
      padding: 3px 6px;
      display: inline-block;
      min-width: 50px;
      text-align: center;
    }
    .heat-high {
      background: #dcfce7;
      color: #166534;
    }
    .heat-mid {
      background: #fef9c3;
      color: #854d0e;
    }
    .heat-low {
      background: #fee2e2;
      color: #991b1b;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-healthy {
      background: #dcfce7;
      color: #166534;
    }
    .badge-warning {
      background: #fef9c3;
      color: #854d0e;
    }
    .badge-imminent, .badge-danger {
      background: #fee2e2;
      color: #991b1b;
    }
    .badge-dormant {
      background: #f1f5f9;
      color: #64748b;
    }
    .footer {
      border-top: 1px solid var(--border);
      padding-top: 14px;
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: var(--text-muted);
    }
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        padding: 0;
        background: #ffffff;
      }
      .kpi-card {
        border-color: #cbd5e1;
      }
    }
  `;
}

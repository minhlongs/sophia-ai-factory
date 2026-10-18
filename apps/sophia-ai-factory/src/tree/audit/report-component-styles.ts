/** Component, badge, hash-chain, footer, and print styles for compliance report HTML */
export const REPORT_COMPONENT_STYLES = `
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
  `

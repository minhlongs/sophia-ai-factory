/**
 * Invoice HTML Inline Stylesheet
 *
 * @module tree/billing/invoices/html-styles
 */

export function getInvoiceCss(statusColor: string): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #f8fafc; color: #0f172a; padding: 32px 16px; }
    .invoice-card { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 24px; }
    .brand-title { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .brand-sub { font-size: 13px; color: #64748b; margin-top: 4px; }
    .invoice-badge-box { text-align: right; }
    .invoice-heading { font-size: 20px; font-weight: 700; color: #0f172a; text-transform: uppercase; }
    .invoice-number { font-size: 14px; font-weight: 600; color: #475569; margin-top: 4px; }
    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-top: 8px; color: #ffffff; background: ${statusColor}; }
    .entity-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
    .entity-col h4 { font-size: 12px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.5px; }
    .entity-col .entity-name { font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
    .entity-col .entity-detail { font-size: 13px; color: #475569; line-height: 1.5; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 32px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; font-size: 13px; }
    .meta-item .label { color: #64748b; margin-bottom: 2px; }
    .meta-item .val { font-weight: 600; color: #0f172a; }
    table.line-items { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    table.line-items th { background: #f1f5f9; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; }
    table.line-items td { padding: 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b; }
    .text-right { text-align: right; }
    .totals-box { margin-left: auto; width: 320px; margin-bottom: 32px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #475569; }
    .total-row.grand-total { border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 12px; font-size: 18px; font-weight: 800; color: #0f172a; }
    .footer-note { border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #64748b; line-height: 1.6; }
    .actions-bar { max-width: 800px; margin: 0 auto 16px auto; display: flex; justify-content: flex-end; gap: 12px; }
    .btn-print { background: #0f172a; color: #ffffff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
    .btn-print:hover { background: #1e293b; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .invoice-card { box-shadow: none; border: none; padding: 0; width: 100%; max-width: 100%; }
      .actions-bar { display: none !important; }
    }
  `;
}

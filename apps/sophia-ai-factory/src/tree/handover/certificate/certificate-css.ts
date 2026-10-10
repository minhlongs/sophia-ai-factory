/**
 * Stylesheet for Printable Handover Acceptance Certificate
 *
 * @module tree/handover/certificate/certificate-css
 */

export const CERTIFICATE_PRINT_CSS = `
    @page { size: A4 portrait; margin: 15mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      line-height: 1.5;
      margin: 0;
      padding: 24px;
      background-color: #f9fafb;
    }
    .cert-container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .badge {
      display: inline-block;
      background: #059669;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      color: #111827;
      margin: 0 0 8px 0;
      letter-spacing: -0.025em;
    }
    .subtitle {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 24px;
    }
    .hash-banner {
      background: #f3f4f6;
      border-left: 4px solid #10b981;
      padding: 12px 16px;
      font-family: monospace;
      font-size: 12px;
      word-break: break-all;
      margin-bottom: 24px;
      border-radius: 0 6px 6px 0;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px 16px;
      background: #fafafa;
    }
    .card-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .card-value {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
    }
    h2 {
      font-size: 16px;
      font-weight: 700;
      color: #1f2937;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 12px;
    }
    ul {
      margin: 0 0 24px 0;
      padding-left: 20px;
    }
    li {
      font-size: 13px;
      color: #374151;
      margin-bottom: 6px;
    }
    .signature-box {
      margin-top: 32px;
      padding: 20px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .seal {
      border: 2px dashed #059669;
      color: #059669;
      padding: 8px 16px;
      font-weight: 800;
      font-size: 13px;
      border-radius: 8px;
      text-transform: uppercase;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .cert-container { border: none; box-shadow: none; padding: 0; }
      .no-print { display: none; }
    }
`;

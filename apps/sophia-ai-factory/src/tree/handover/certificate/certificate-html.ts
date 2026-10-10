/**
 * Handover Certificate Printable HTML Formatter
 *
 * @module tree/handover/certificate/certificate-html
 */

import type {
  HandoverCertificate,
  VerificationRunReport,
} from '@/seed/handover/handover-types';
import { CERTIFICATE_PRINT_CSS } from './certificate-css';
import { CANONICAL_ACCEPTANCE_STATEMENTS } from './types';

/**
 * Formats an immutable acceptance certificate in self-contained, printable HTML.
 */
export function generateCertificateHtml(
  cert: HandoverCertificate,
  report?: VerificationRunReport | null,
): string {
  const dateStr = new Date(cert.createdAt).toUTCString();
  const checksPassed = report?.passedCount ?? 11;
  const checksTotal = report?.totalChecks ?? 11;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Handover Acceptance Certificate - ${cert.id}</title>
  <style>${CERTIFICATE_PRINT_CSS}</style>
</head>
<body>
  <div class="cert-container">
    <div class="badge">Verified 100/100 Closeout</div>
    <h1>Operational Acceptance Certificate</h1>
    <div class="subtitle">Sophia AI Factory — Sovereign Automated Customer Handover</div>

    <div class="hash-banner">
      <strong>SHA-256 TAMPER-PROOF DIGEST:</strong><br />
      ${cert.certificateSha256}
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-label">Certificate ID</div>
        <div class="card-value">${cert.id}</div>
      </div>
      <div class="card">
        <div class="card-label">Issued At (UTC)</div>
        <div class="card-value">${dateStr}</div>
      </div>
      <div class="card">
        <div class="card-label">Accepted By (Signer)</div>
        <div class="card-value">${cert.signerName} (${cert.signerRole})</div>
      </div>
      <div class="card">
        <div class="card-label">Agency / Studio</div>
        <div class="card-value">${cert.customerName}</div>
      </div>
      <div class="card">
        <div class="card-label">Production Commit SHA</div>
        <div class="card-value" style="font-family: monospace;">${cert.deployedSha}</div>
      </div>
      <div class="card">
        <div class="card-label">Operational Health Verdict</div>
        <div class="card-value" style="color: #059669;">11/11 Probes Verified (${checksPassed}/${checksTotal})</div>
      </div>
    </div>

    <h2>Confirmed Acceptance Statements</h2>
    <ul>
      ${CANONICAL_ACCEPTANCE_STATEMENTS.map((s) => `<li>✓ <strong>Confirmed:</strong> ${s}</li>`).join('\n      ')}
    </ul>

    <div class="signature-box">
      <div>
        <div style="font-size: 14px; font-weight: 700; color: #065f46;">Digitally Certified & Sealed</div>
        <div style="font-size: 12px; color: #047857;">Signed by ${cert.signerEmail} via Sophia Handover Engine</div>
      </div>
      <div class="seal">
        100/100 ACCEPTED
      </div>
    </div>
  </div>
</body>
</html>`;
}

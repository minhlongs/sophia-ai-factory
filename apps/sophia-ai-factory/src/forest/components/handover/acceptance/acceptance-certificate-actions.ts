/**
 * Acceptance Client Submodule: Certificate Download & Print Actions.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/acceptance/acceptance-certificate-actions
 */

import type { HandoverCertificate } from '@/seed/handover/handover-types';
import {
  generateCertificateHtml,
  generateCertificateMarkdown,
} from '@/tree/handover/handover-certificate-engine';

export function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function createCertificateExportHandlers(certificate: HandoverCertificate | null) {
  const handleDownloadMarkdown = () => {
    if (!certificate) return;
    const content =
      certificate.contentMarkdown || generateCertificateMarkdown(certificate, null);
    downloadBlob(
      content,
      `handover-certificate-${certificate.id}.md`,
      'text/markdown;charset=utf-8',
    );
  };

  const handleDownloadHtml = () => {
    if (!certificate) return;
    const content = generateCertificateHtml(certificate, null);
    downloadBlob(
      content,
      `handover-certificate-${certificate.id}.html`,
      'text/html;charset=utf-8',
    );
  };

  const handlePrintCertificate = () => {
    if (!certificate) return;
    const htmlContent = generateCertificateHtml(certificate, null);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
    }
  };

  return {
    handleDownloadMarkdown,
    handleDownloadHtml,
    handlePrintCertificate,
  };
}

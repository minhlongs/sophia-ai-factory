/**
 * Acceptance Client Submodule: Sign-off State Hook.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/acceptance/use-acceptance-signoff
 */

import { useState } from 'react';
import type {
  CustomerHandoverRecord,
  HandoverAcceptanceInput,
  HandoverCertificate,
} from '@/seed/handover/handover-types';
import type { Result } from '@/seed/types/result';
import {
  CANONICAL_ACCEPTANCE_STATEMENTS,
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

interface UseAcceptanceSignoffParams {
  handover: CustomerHandoverRecord;
  initialCertificate: HandoverCertificate | null;
  onSignAction?: (
    input: HandoverAcceptanceInput,
  ) => Promise<Result<{ certificate: HandoverCertificate; record: CustomerHandoverRecord }, { code: string; message: string }>>;
}

export function useAcceptanceSignoff({
  handover,
  initialCertificate,
  onSignAction,
}: UseAcceptanceSignoffParams) {
  const [currentHandover, setCurrentHandover] = useState<CustomerHandoverRecord>(handover);
  const [certificate, setCertificate] = useState<HandoverCertificate | null>(initialCertificate);
  const isAccepted = currentHandover.acceptance_status === 'accepted' || !!certificate;

  const [signerName, setSignerName] = useState(currentHandover.signer_name || '');
  const [signerEmail, setSignerEmail] = useState(currentHandover.signer_email || '');
  const [signerRole, setSignerRole] = useState(currentHandover.signer_role || 'Chief Executive Officer (CEO)');
  const [confirmedStatements, setConfirmedStatements] = useState<Record<number, boolean>>({
    0: isAccepted,
    1: isAccepted,
    2: isAccepted,
    3: isAccepted,
  });
  const [legalConsent, setLegalConsent] = useState(isAccepted);
  const [isSigning, setIsSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const [showFounderModal, setShowFounderModal] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  const allStatementsChecked = [0, 1, 2, 3].every((i) => confirmedStatements[i]);
  const canSubmit =
    !isAccepted &&
    allStatementsChecked &&
    legalConsent &&
    signerName.trim().length > 1 &&
    signerEmail.trim().length > 3 &&
    !isSigning;

  const handleCheckboxToggle = (index: number) => {
    if (isAccepted) return;
    setConfirmedStatements((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleSignAcceptance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSigning(true);
    setSignError(null);

    try {
      if (onSignAction) {
        const res = await onSignAction({
          handoverId: currentHandover.id,
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim(),
          signerRole: signerRole.trim(),
          acceptanceStatements: CANONICAL_ACCEPTANCE_STATEMENTS,
        });

        if (res.ok) {
          setCertificate(res.value.certificate);
          setCurrentHandover(res.value.record);
        } else {
          setSignError(res.error.message || 'Failed to sign acceptance certificate.');
        }
      } else {
        const res = await fetch('/api/admin/handover/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handoverId: currentHandover.id, persist: true }),
        });
        if (!res.ok) {
          throw new Error(`Verification endpoint failed with status ${res.status}`);
        }
      }
    } catch (err) {
      setSignError(err instanceof Error ? err.message : 'An unexpected error occurred during sign-off.');
    } finally {
      setIsSigning(false);
    }
  };

  const handleCopyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadMarkdown = () => {
    if (!certificate) return;
    const content = certificate.contentMarkdown || generateCertificateMarkdown(certificate, null);
    downloadBlob(content, `handover-certificate-${certificate.id}.md`, 'text/markdown;charset=utf-8');
  };

  const handleDownloadHtml = () => {
    if (!certificate) return;
    const content = generateCertificateHtml(certificate, null);
    downloadBlob(content, `handover-certificate-${certificate.id}.html`, 'text/html;charset=utf-8');
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
    currentHandover,
    certificate,
    isAccepted,
    signerName,
    setSignerName,
    signerEmail,
    setSignerEmail,
    signerRole,
    setSignerRole,
    confirmedStatements,
    legalConsent,
    setLegalConsent,
    isSigning,
    signError,
    showFounderModal,
    setShowFounderModal,
    copiedHash,
    canSubmit,
    handleCheckboxToggle,
    handleSignAcceptance,
    handleCopyHash,
    handleDownloadMarkdown,
    handleDownloadHtml,
    handlePrintCertificate,
  };
}

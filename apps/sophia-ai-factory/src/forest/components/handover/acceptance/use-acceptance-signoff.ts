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
import { CANONICAL_ACCEPTANCE_STATEMENTS } from '@/tree/handover/handover-certificate-engine';
import {
  downloadBlob,
  createCertificateExportHandlers,
} from './acceptance-certificate-actions';

export { downloadBlob } from './acceptance-certificate-actions';

interface UseAcceptanceSignoffParams {
  handover: CustomerHandoverRecord;
  initialCertificate: HandoverCertificate | null;
  onSignAction?: (
    input: HandoverAcceptanceInput,
  ) => Promise<
    Result<
      { certificate: HandoverCertificate; record: CustomerHandoverRecord },
      { code: string; message: string }
    >
  >;
}

export function useAcceptanceSignoff({
  handover,
  initialCertificate,
  onSignAction,
}: UseAcceptanceSignoffParams) {
  const [currentHandover, setCurrentHandover] = useState<CustomerHandoverRecord>(handover);
  const [certificate, setCertificate] = useState<HandoverCertificate | null>(
    initialCertificate,
  );
  const isAccepted = currentHandover.acceptance_status === 'accepted' || !!certificate;

  const [signerName, setSignerName] = useState(currentHandover.signer_name || '');
  const [signerEmail, setSignerEmail] = useState(currentHandover.signer_email || '');
  const [signerRole, setSignerRole] = useState(
    currentHandover.signer_role || 'Chief Executive Officer (CEO)',
  );
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
      setSignError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred during sign-off.',
      );
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

  const exportHandlers = createCertificateExportHandlers(certificate);

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
    ...exportHandlers,
  };
}

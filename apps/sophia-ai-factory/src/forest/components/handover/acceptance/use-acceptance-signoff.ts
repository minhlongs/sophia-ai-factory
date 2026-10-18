/**
 * Acceptance Client Submodule: Sign-off State Hook.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/acceptance/use-acceptance-signoff
 */

import { useState } from 'react';
import type {
  CustomerHandoverRecord,
  HandoverCertificate,
} from '@/seed/handover/handover-types';
import { createCertificateExportHandlers } from './acceptance-certificate-actions';
import {
  executeSignAcceptance,
  type UseAcceptanceSignoffParams,
} from './acceptance-signoff-submit';

export { downloadBlob } from './acceptance-certificate-actions';
export type { UseAcceptanceSignoffParams, SignAcceptanceAction } from './acceptance-signoff-submit';

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
      await executeSignAcceptance({
        handoverId: currentHandover.id,
        signerName,
        signerEmail,
        signerRole,
        onSignAction,
        onSuccess: (nextCertificate, nextRecord) => {
          setCertificate(nextCertificate);
          setCurrentHandover(nextRecord);
        },
        onError: setSignError,
      });
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

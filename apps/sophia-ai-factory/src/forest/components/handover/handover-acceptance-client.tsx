'use client';

/**
 * Customer Handover & Acceptance Sign-off Client - Root Facade.
 * Layer: forest/components (UI orchestration; imports from @/seed and @/tree)
 *
 * Provides the interactive customer-facing handover dashboard with milestone tracking,
 * 15-point deliverables audit, Day-1 health verification card, founder 30-minute action modal,
 * digital acceptance sign-off form, and tamper-evident certificate viewer.
 *
 * @module forest/components/handover/handover-acceptance-client
 */

import React from 'react';
import {
  type HandoverAcceptanceClientProps,
  useAcceptanceSignoff,
  MilestoneTracker,
  Day1HealthCard,
  DeliverablesGrid,
  VerifiedCertificateCard,
  SignoffFormCard,
  FounderTransferModal,
} from './acceptance';
import { HandoverAcceptanceHeader } from './handover-acceptance-header';

export * from './acceptance';

export function HandoverAcceptanceClient({
  handover,
  initialCertificate,
  locale: _locale,
  onSignAction,
}: HandoverAcceptanceClientProps) {
  const {
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
  } = useAcceptanceSignoff({
    handover,
    initialCertificate,
    onSignAction,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <HandoverAcceptanceHeader
        currentHandover={currentHandover}
        isAccepted={isAccepted}
        onOpenFounderModal={() => setShowFounderModal(true)}
      />

      <MilestoneTracker isAccepted={isAccepted} />

      <Day1HealthCard currentHandover={currentHandover} />

      <DeliverablesGrid />

      {isAccepted && certificate && (
        <VerifiedCertificateCard
          certificate={certificate}
          copiedHash={copiedHash}
          onCopyHash={handleCopyHash}
          onDownloadMarkdown={handleDownloadMarkdown}
          onDownloadHtml={handleDownloadHtml}
          onPrintCertificate={handlePrintCertificate}
        />
      )}

      {!isAccepted && (
        <SignoffFormCard
          signError={signError}
          confirmedStatements={confirmedStatements}
          onCheckboxToggle={handleCheckboxToggle}
          signerName={signerName}
          setSignerName={setSignerName}
          signerRole={signerRole}
          setSignerRole={setSignerRole}
          signerEmail={signerEmail}
          setSignerEmail={setSignerEmail}
          legalConsent={legalConsent}
          setLegalConsent={setLegalConsent}
          canSubmit={canSubmit}
          isSigning={isSigning}
          onSignAcceptance={handleSignAcceptance}
        />
      )}

      <FounderTransferModal
        show={showFounderModal}
        onClose={() => setShowFounderModal(false)}
      />
    </div>
  );
}

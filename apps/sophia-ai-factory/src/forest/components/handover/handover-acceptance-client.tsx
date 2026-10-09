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
import { useTranslations } from 'next-intl';
import { Check, Clock, ShieldCheck, Sparkles } from 'lucide-react';
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

export * from './acceptance';

export function HandoverAcceptanceClient({
  handover,
  initialCertificate,
  locale: _locale,
  onSignAction,
}: HandoverAcceptanceClientProps) {
  const t = useTranslations('handover');
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
      {/* ── Page Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              {currentHandover.tier} TIER
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {currentHandover.agency_name}
            </span>
            {isAccepted ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Check className="w-3 h-3" />
                {t('milestones.completed')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Clock className="w-3 h-3" />
                {t('milestones.pending')}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {t('portalTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            {t('portalSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowFounderModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            {t('founder30Button')}
          </button>
        </div>
      </div>

      {/* ── Milestone Progress Tracker ────────────────────────────────────────── */}
      <MilestoneTracker isAccepted={isAccepted} />

      {/* ── Day-1 Operational Health Card ─────────────────────────────────────── */}
      <Day1HealthCard currentHandover={currentHandover} />

      {/* ── Deliverables Audit Grid (15 Critical Assets) ───────────────────────── */}
      <DeliverablesGrid />

      {/* ── Verified Certificate Viewer (Rendered once signed) ───────────────── */}
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

      {/* ── Digital Acceptance Sign-off Card (Interactive Form) ───────────────── */}
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

      {/* ── Founder 30-Minute Action Plan Modal ───────────────────────────────── */}
      <FounderTransferModal
        show={showFounderModal}
        onClose={() => setShowFounderModal(false)}
      />
    </div>
  );
}

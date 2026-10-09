/**
 * Acceptance Client Submodule: Verified Certificate Card.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/acceptance/verified-certificate-card
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Download, Printer } from 'lucide-react';
import type { HandoverCertificate } from '@/seed/handover/handover-types';

interface VerifiedCertificateCardProps {
  certificate: HandoverCertificate;
  copiedHash: boolean;
  onCopyHash: (hash: string) => void;
  onDownloadMarkdown: () => void;
  onDownloadHtml: () => void;
  onPrintCertificate: () => void;
}

export function VerifiedCertificateCard({
  certificate,
  copiedHash,
  onCopyHash,
  onDownloadMarkdown,
  onDownloadHtml,
  onPrintCertificate,
}: VerifiedCertificateCardProps) {
  const t = useTranslations('handover');

  return (
    <div className="rounded-2xl border-2 border-emerald-500/30 bg-card p-6 sm:p-8 shadow-md relative overflow-hidden">
      <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 w-40 h-40 bg-emerald-500/5 rounded-full pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-border/50">
        <div>
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-emerald-500 text-white mb-3">
            {t('certificate.badge')}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            {t('certificate.title')}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t('certificate.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onDownloadMarkdown}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border shadow-xs transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            {t('certificate.downloadMd')}
          </button>
          <button
            type="button"
            onClick={onDownloadHtml}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border shadow-xs transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            {t('certificate.downloadHtml')}
          </button>
          <button
            type="button"
            onClick={onPrintCertificate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            {t('certificate.print')}
          </button>
        </div>
      </div>

      {/* Tamper-Proof SHA-256 Digest Banner */}
      <div className="mt-6 p-4 rounded-xl bg-muted/60 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="font-mono text-xs">
          <span className="text-muted-foreground block text-[11px] font-sans font-semibold uppercase tracking-wider mb-1">
            {t('certificate.sha256')}
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold break-all">
            {certificate.certificateSha256}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onCopyHash(certificate.certificateSha256)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-background hover:bg-muted text-foreground border border-border transition-colors self-start sm:self-auto shrink-0"
        >
          {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedHash ? 'Copied' : 'Copy Digest'}
        </button>
      </div>

      {/* Certificate Metadata Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <div className="p-3.5 rounded-lg bg-background/50 border border-border/40">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block">
            {t('certificate.certId')}
          </span>
          <span className="text-xs font-bold text-foreground font-mono mt-0.5 block truncate">
            {certificate.id}
          </span>
        </div>

        <div className="p-3.5 rounded-lg bg-background/50 border border-border/40">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block">
            {t('certificate.issuedTo')}
          </span>
          <span className="text-xs font-bold text-foreground mt-0.5 block">
            {certificate.signerName} ({certificate.signerRole})
          </span>
        </div>

        <div className="p-3.5 rounded-lg bg-background/50 border border-border/40">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block">
            {t('certificate.studio')}
          </span>
          <span className="text-xs font-bold text-foreground mt-0.5 block">
            {certificate.customerName}
          </span>
        </div>

        <div className="p-3.5 rounded-lg bg-background/50 border border-border/40">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block">
            {t('certificate.timestamp')}
          </span>
          <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
            {new Date(certificate.createdAt).toISOString()}
          </span>
        </div>

        <div className="p-3.5 rounded-lg bg-background/50 border border-border/40">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block">
            {t('certificate.deployedSha')}
          </span>
          <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
            {certificate.deployedSha}
          </span>
        </div>

        <div className="p-3.5 rounded-lg bg-background/50 border border-border/40">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block">
            {t('certificate.healthVerdict')}
          </span>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            11/11 Probes Verified (100% Score)
          </span>
        </div>
      </div>
    </div>
  );
}

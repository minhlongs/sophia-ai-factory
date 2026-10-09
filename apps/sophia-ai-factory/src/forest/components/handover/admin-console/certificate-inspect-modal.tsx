/**
 * Admin Console Submodule: Certificate Inspection Modal.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/admin-console/certificate-inspect-modal
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck, Check, Copy, X } from 'lucide-react';
import type { CustomerHandoverRecord } from '@/seed/handover/handover-types';

interface CertificateInspectModalProps {
  record: CustomerHandoverRecord | null;
  copiedHash: boolean;
  onCopyHash: (hash: string) => void;
  onClose: () => void;
}

export function CertificateInspectModal({
  record,
  copiedHash,
  onCopyHash,
  onClose,
}: CertificateInspectModalProps) {
  const t = useTranslations('admin.handover');

  if (!record) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base font-bold text-foreground">{t('certModal.title')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('certModal.close') || 'Close inspection modal'}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-lg bg-muted/60 border border-border">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
              {t('certModal.hash')}
            </span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold break-all block">
              {record.certificate_hash || 'N/A'}
            </span>
            {record.certificate_hash && (
              <button
                type="button"
                onClick={() => onCopyHash(record.certificate_hash!)}
                className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] bg-background border border-border font-medium hover:bg-muted"
              >
                {copiedHash ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {copiedHash ? 'Copied' : 'Copy Hash'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-background border border-border">
              <span className="text-muted-foreground block mb-0.5">{t('certModal.signer')}</span>
              <span className="font-bold text-foreground">{record.signer_name}</span>
            </div>
            <div className="p-3 rounded-lg bg-background border border-border">
              <span className="text-muted-foreground block mb-0.5">{t('certModal.role')}</span>
              <span className="font-bold text-foreground">{record.signer_role}</span>
            </div>
            <div className="p-3 rounded-lg bg-background border border-border">
              <span className="text-muted-foreground block mb-0.5">{t('certModal.signedAt')}</span>
              <span className="font-bold text-foreground font-mono">
                {record.signed_at ? new Date(record.signed_at).toISOString() : 'N/A'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-background border border-border">
              <span className="text-muted-foreground block mb-0.5">{t('certModal.tier')}</span>
              <span className="font-bold text-foreground">{record.tier}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors"
          >
            {t('certModal.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

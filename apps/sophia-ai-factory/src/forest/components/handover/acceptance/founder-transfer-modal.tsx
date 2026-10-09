/**
 * Acceptance Client Submodule: Founder 30-Minute Action Plan Modal.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/acceptance/founder-transfer-modal
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, X } from 'lucide-react';

interface FounderTransferModalProps {
  show: boolean;
  onClose: () => void;
}

export function FounderTransferModal({ show, onClose }: FounderTransferModalProps) {
  const t = useTranslations('handover');

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">{t('founder30.title')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('founder30.close') || 'Close'}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('founder30.subtitle')}
        </p>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-background border border-border/60">
            <h4 className="text-sm font-bold text-foreground flex items-center justify-between">
              <span>{t('founder30.task1Title')}</span>
              <span className="text-xs font-semibold text-primary px-2 py-0.5 rounded bg-primary/10">P0</span>
            </h4>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {t('founder30.task1Desc')}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-background border border-border/60">
            <h4 className="text-sm font-bold text-foreground flex items-center justify-between">
              <span>{t('founder30.task2Title')}</span>
              <span className="text-xs font-semibold text-primary px-2 py-0.5 rounded bg-primary/10">P0</span>
            </h4>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {t('founder30.task2Desc')}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-background border border-border/60">
            <h4 className="text-sm font-bold text-foreground flex items-center justify-between">
              <span>{t('founder30.task3Title')}</span>
              <span className="text-xs font-semibold text-primary px-2 py-0.5 rounded bg-primary/10">P0</span>
            </h4>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {t('founder30.task3Desc')}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-background border border-border/60">
            <h4 className="text-sm font-bold text-foreground flex items-center justify-between">
              <span>{t('founder30.task4Title')}</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10">P1</span>
            </h4>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {t('founder30.task4Desc')}
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors"
          >
            {t('founder30.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Director's Control Deck — Commercial SaaS Upgrade & License Validation Modal
 *
 * @module components/open-core/commercial-upgrade-modal
 */

'use client';

import React, { useState } from 'react';
import { CheckCircle2, Cloud, KeyRound, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { FeatureGateEvaluation } from '@/seed/config/edition-config';
import { UPGRADE_MODAL_COPY } from './commercial-upgrade-modal-copy';

export interface CommercialUpgradeModalProps {
  readonly evaluation: FeatureGateEvaluation | null;
  readonly locale?: 'vi' | 'en';
  readonly onClose: () => void;
  readonly onValidateLicenseKey?: (licenseKey: string) => Promise<void> | void;
  readonly validationFeedback?: { readonly ok: boolean; readonly message: string } | null;
}

export function CommercialUpgradeModal({
  evaluation,
  locale = 'vi',
  onClose,
  onValidateLicenseKey,
  validationFeedback,
}: CommercialUpgradeModalProps) {
  const [licenseKey, setLicenseKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!evaluation || evaluation.allowed) return null;

  const copy = locale === 'vi' ? UPGRADE_MODAL_COPY.vi : UPGRADE_MODAL_COPY.en;
  const title = locale === 'vi' ? evaluation.feature.titleVi : evaluation.feature.titleEn;
  const summary = locale === 'vi' ? evaluation.messageVi : evaluation.messageEn;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim() || !onValidateLicenseKey) return;
    setIsSubmitting(true);
    try {
      await onValidateLicenseKey(licenseKey.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sophia-upgrade-modal-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold tracking-wider text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{copy.badge}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.closeBtn}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3 id="sophia-upgrade-modal-title" className="mt-4 text-xl font-bold text-white">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{summary}</p>

        <div className="mt-4 rounded-xl border border-slate-800/90 bg-slate-900/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
            {copy.benefitsTitle}
          </p>
          <ul className="mt-2.5 space-y-2 text-xs text-slate-300">
            {copy.benefits.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <a
            href={evaluation.upgradeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-amber-400"
          >
            <Cloud className="h-4 w-4" />
            <span>{copy.cloudCta}</span>
          </a>

          {onValidateLicenseKey && (
            <form onSubmit={handleSubmit} className="mt-2 border-t border-slate-800 pt-3">
              <label className="block text-xs font-medium text-slate-400">
                {copy.licenseLabel}
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder={copy.licensePlaceholder}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !licenseKey.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>{isSubmitting ? copy.validatingBtn : copy.validateBtn}</span>
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">{copy.persistHint}</p>
              {validationFeedback && (
                <div
                  className={`mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ${
                    validationFeedback.ok
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border border-rose-500/30 bg-rose-500/10 text-rose-300'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>{validationFeedback.message}</span>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

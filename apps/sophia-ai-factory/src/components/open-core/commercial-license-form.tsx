'use client';

import React, { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import type { UPGRADE_MODAL_COPY } from './commercial-upgrade-modal-copy';

export interface CommercialLicenseValidationFormProps {
  readonly copy: (typeof UPGRADE_MODAL_COPY)['vi'] | (typeof UPGRADE_MODAL_COPY)['en'];
  readonly onValidateLicenseKey: (licenseKey: string) => Promise<void> | void;
  readonly validationFeedback?: { readonly ok: boolean; readonly message: string } | null;
}

export function CommercialLicenseValidationForm({
  copy,
  onValidateLicenseKey,
  validationFeedback,
}: CommercialLicenseValidationFormProps) {
  const [licenseKey, setLicenseKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  );
}

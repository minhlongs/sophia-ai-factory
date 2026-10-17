/**
 * White-Label Manager Branding Form Footer, Text Fields & Feedback Alerts.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/branding-form-footer
 */

import React from 'react';
import { Sparkles, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { BrandingFormLabels } from './types';

export interface BrandingTextFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}

export function BrandingTextField({
  label,
  value,
  onChange,
  placeholder,
}: BrandingTextFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-zinc-300">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}

export interface BrandingFormFooterProps {
  brandingSuccess: string | null;
  brandingError: string | null;
  isSavingBranding: boolean;
  onResetDefaults: () => void;
  labels: BrandingFormLabels;
}

export function BrandingFormFooter({
  brandingSuccess,
  brandingError,
  isSavingBranding,
  onResetDefaults,
  labels,
}: BrandingFormFooterProps) {
  return (
    <>
      {brandingError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{brandingError}</span>
        </div>
      )}

      {brandingSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{brandingSuccess}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
        <button
          type="button"
          onClick={onResetDefaults}
          className="text-xs text-zinc-400 hover:text-white transition-colors"
        >
          {labels.actions.reset}
        </button>

        <button
          type="submit"
          disabled={isSavingBranding}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-semibold px-6 py-2.5 rounded-xl shadow-lg transition-all"
        >
          {isSavingBranding ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              {labels.actions.saving}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {labels.actions.save}
            </>
          )}
        </button>
      </div>
    </>
  );
}

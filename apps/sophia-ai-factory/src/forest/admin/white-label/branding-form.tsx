/**
 * White-Label Manager Branding Form Component.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/branding-form
 */

import React from 'react';
import { Palette, Sparkles, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BrandingColorPicker } from './branding-color-picker';
import { BrandingImageField } from './branding-image-field';
import type { BrandingFormLabels } from './types';

interface BrandingFormProps {
  agencyName: string;
  setAgencyName: (val: string) => void;
  logoUrl: string;
  setLogoUrl: (val: string) => void;
  faviconUrl: string;
  setFaviconUrl: (val: string) => void;
  primaryColor: string;
  setPrimaryColor: (val: string) => void;
  accentColor: string;
  setAccentColor: (val: string) => void;
  pageTitle: string;
  setPageTitle: (val: string) => void;
  footerText: string;
  setFooterText: (val: string) => void;
  brandingSuccess: string | null;
  brandingError: string | null;
  isSavingBranding: boolean;
  onSaveBranding: (e: React.FormEvent) => Promise<void>;
  onResetDefaults: () => void;
  labels: BrandingFormLabels;
}

export function BrandingForm({
  agencyName,
  setAgencyName,
  logoUrl,
  setLogoUrl,
  faviconUrl,
  setFaviconUrl,
  primaryColor,
  setPrimaryColor,
  accentColor,
  setAccentColor,
  pageTitle,
  setPageTitle,
  footerText,
  setFooterText,
  brandingSuccess,
  brandingError,
  isSavingBranding,
  onSaveBranding,
  onResetDefaults,
  labels,
}: BrandingFormProps) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Palette className="w-5 h-5 text-indigo-400" />
          {labels.title}
        </h2>
        <p className="text-sm text-zinc-400 mt-1">{labels.description}</p>
      </div>

      <form onSubmit={onSaveBranding} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300">{labels.fields.agencyName}</label>
          <input
            type="text"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            placeholder={labels.fields.agencyNamePlaceholder}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <BrandingImageField
          label={labels.fields.logoUrl}
          value={logoUrl}
          onChange={setLogoUrl}
          placeholder={labels.fields.logoUrlPlaceholder}
          imageAlt="Logo Preview"
        />

        <BrandingImageField
          label={labels.fields.faviconUrl}
          value={faviconUrl}
          onChange={setFaviconUrl}
          placeholder={labels.fields.faviconUrlPlaceholder}
          imageAlt="Favicon Preview"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <BrandingColorPicker
            label={labels.fields.primaryColor}
            helpText={labels.fields.primaryColorHelp}
            color={primaryColor}
            onChange={setPrimaryColor}
          />
          <BrandingColorPicker
            label={labels.fields.accentColor}
            helpText={labels.fields.accentColorHelp}
            color={accentColor}
            onChange={setAccentColor}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300">{labels.fields.pageTitle}</label>
          <input
            type="text"
            value={pageTitle}
            onChange={(e) => setPageTitle(e.target.value)}
            placeholder={labels.fields.pageTitlePlaceholder}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300">{labels.fields.footerText}</label>
          <input
            type="text"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder={labels.fields.footerTextPlaceholder}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

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
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-lg transition-all"
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
      </form>
    </div>
  );
}

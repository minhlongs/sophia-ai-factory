/**
 * White-Label Manager Branding Form Component.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/branding-form
 */

import React from 'react';
import { Palette } from 'lucide-react';
import { BrandingColorPicker } from './branding-color-picker';
import { BrandingImageField } from './branding-image-field';
import { BrandingFormFooter, BrandingTextField } from './branding-form-footer';
import type { BrandingFormLabels } from './types';

export { BrandingFormFooter, BrandingTextField, type BrandingFormFooterProps, type BrandingTextFieldProps } from './branding-form-footer';

export interface BrandingFormProps {
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

export function BrandingForm(props: BrandingFormProps) {
  const {
    agencyName, setAgencyName, logoUrl, setLogoUrl, faviconUrl, setFaviconUrl,
    primaryColor, setPrimaryColor, accentColor, setAccentColor,
    pageTitle, setPageTitle, footerText, setFooterText,
    brandingSuccess, brandingError, isSavingBranding,
    onSaveBranding, onResetDefaults, labels,
  } = props;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          {labels.title}
        </h2>
        <p className="text-sm text-zinc-400 mt-1">{labels.description}</p>
      </div>

      <form onSubmit={onSaveBranding} className="space-y-5">
        <BrandingTextField
          label={labels.fields.agencyName}
          value={agencyName}
          onChange={setAgencyName}
          placeholder={labels.fields.agencyNamePlaceholder}
        />

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

        <BrandingTextField
          label={labels.fields.pageTitle}
          value={pageTitle}
          onChange={setPageTitle}
          placeholder={labels.fields.pageTitlePlaceholder}
        />

        <BrandingTextField
          label={labels.fields.footerText}
          value={footerText}
          onChange={setFooterText}
          placeholder={labels.fields.footerTextPlaceholder}
        />

        <BrandingFormFooter
          brandingSuccess={brandingSuccess}
          brandingError={brandingError}
          isSavingBranding={isSavingBranding}
          onResetDefaults={onResetDefaults}
          labels={labels}
        />
      </form>
    </div>
  );
}

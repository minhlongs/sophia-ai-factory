'use client';

/**
 * White-Label Branding Tab Split View (Form + Sticky Side Preview)
 *
 * @module forest/admin/white-label/branding-tab-content
 */

import React from 'react';
import { BrandingForm } from './branding-form';
import { SidePreviewCard } from './side-preview-card';

type BrandingFormProps = React.ComponentProps<typeof BrandingForm>;
type SidePreviewCardProps = React.ComponentProps<typeof SidePreviewCard>;

export interface BrandingTabContentProps
  extends Omit<BrandingFormProps, 'labels'> {
  primaryContrast: SidePreviewCardProps['primaryContrast'];
  formLabels: BrandingFormProps['labels'];
  previewLabels: SidePreviewCardProps['labels'];
}

export function BrandingTabContent({
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
  primaryContrast,
  formLabels,
  previewLabels,
}: BrandingTabContentProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-7">
        <BrandingForm
          agencyName={agencyName}
          setAgencyName={setAgencyName}
          logoUrl={logoUrl}
          setLogoUrl={setLogoUrl}
          faviconUrl={faviconUrl}
          setFaviconUrl={setFaviconUrl}
          primaryColor={primaryColor}
          setPrimaryColor={setPrimaryColor}
          accentColor={accentColor}
          setAccentColor={setAccentColor}
          pageTitle={pageTitle}
          setPageTitle={setPageTitle}
          footerText={footerText}
          setFooterText={setFooterText}
          brandingSuccess={brandingSuccess}
          brandingError={brandingError}
          isSavingBranding={isSavingBranding}
          onSaveBranding={onSaveBranding}
          onResetDefaults={onResetDefaults}
          labels={formLabels}
        />
      </div>

      <div className="lg:col-span-5 sticky top-6">
        <SidePreviewCard
          agencyName={agencyName}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
          accentColor={accentColor}
          pageTitle={pageTitle}
          footerText={footerText}
          primaryContrast={primaryContrast}
          labels={previewLabels}
        />
      </div>
    </div>
  );
}

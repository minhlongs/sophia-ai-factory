/**
 * White-Label Manager Component (Root Facade).
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label-manager
 */

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { WhiteLabelManagerProps } from './white-label/types';
import { useWhiteLabelState } from './white-label/use-white-label-state';
import { HeaderTabs } from './white-label/header-tabs';
import { DomainsTab } from './white-label/domains-tab';
import { BrandingForm } from './white-label/branding-form';
import { SidePreviewCard } from './white-label/side-preview-card';
import { FullPreviewTab } from './white-label/full-preview-tab';
import {
  getHeaderTabLabels,
  getDomainsTabLabels,
  getBrandingFormLabels,
  getSidePreviewLabels,
  getFullPreviewLabels,
} from './white-label/white-label-labels';

export type { WhiteLabelManagerProps } from './white-label/types';

export function WhiteLabelManager({
  orgId,
  initialDomains = [],
  initialBranding = null,
  actions = {},
}: WhiteLabelManagerProps) {
  const t = useTranslations('whiteLabel');

  const {
    activeTab,
    setActiveTab,
    domains,
    newHostname,
    setNewHostname,
    isAddingDomain,
    domainError,
    domainSuccess,
    handleAddDomain,
    verifyingDomainId,
    deletingDomainId,
    copiedKey,
    handleVerifyDomain,
    handleDeleteDomain,
    handleCopy,
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
    isSavingBranding,
    brandingSuccess,
    brandingError,
    primaryContrast,
    handleSaveBranding,
    handleResetDefaults,
  } = useWhiteLabelState({
    orgId,
    initialDomains,
    initialBranding,
    actions,
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 text-zinc-100">
      <HeaderTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        labels={getHeaderTabLabels(t)}
      />

      {activeTab === 'domains' && (
        <DomainsTab
          domains={domains}
          newHostname={newHostname}
          setNewHostname={setNewHostname}
          isAddingDomain={isAddingDomain}
          domainError={domainError}
          domainSuccess={domainSuccess}
          onAddDomain={handleAddDomain}
          verifyingDomainId={verifyingDomainId}
          deletingDomainId={deletingDomainId}
          copiedKey={copiedKey}
          onVerifyDomain={handleVerifyDomain}
          onDeleteDomain={handleDeleteDomain}
          onCopy={handleCopy}
          labels={getDomainsTabLabels(t)}
        />
      )}

      {activeTab === 'branding' && (
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
              onSaveBranding={handleSaveBranding}
              onResetDefaults={handleResetDefaults}
              labels={getBrandingFormLabels(t)}
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
              labels={getSidePreviewLabels(t)}
            />
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <FullPreviewTab
          agencyName={agencyName}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
          accentColor={accentColor}
          pageTitle={pageTitle}
          footerText={footerText}
          primaryContrast={primaryContrast}
          labels={getFullPreviewLabels(t)}
        />
      )}
    </div>
  );
}

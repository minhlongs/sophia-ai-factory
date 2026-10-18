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
import { BrandingTabContent } from './white-label/branding-tab-content';
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
  const state = useWhiteLabelState({
    orgId,
    initialDomains,
    initialBranding,
    actions,
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 text-zinc-100">
      <HeaderTabs
        activeTab={state.activeTab}
        setActiveTab={state.setActiveTab}
        labels={getHeaderTabLabels(t)}
      />

      {state.activeTab === 'domains' && (
        <DomainsTab
          domains={state.domains}
          newHostname={state.newHostname}
          setNewHostname={state.setNewHostname}
          isAddingDomain={state.isAddingDomain}
          domainError={state.domainError}
          domainSuccess={state.domainSuccess}
          onAddDomain={state.handleAddDomain}
          verifyingDomainId={state.verifyingDomainId}
          deletingDomainId={state.deletingDomainId}
          copiedKey={state.copiedKey}
          onVerifyDomain={state.handleVerifyDomain}
          onDeleteDomain={state.handleDeleteDomain}
          onCopy={state.handleCopy}
          labels={getDomainsTabLabels(t)}
        />
      )}

      {state.activeTab === 'branding' && (
        <BrandingTabContent
          agencyName={state.agencyName}
          setAgencyName={state.setAgencyName}
          logoUrl={state.logoUrl}
          setLogoUrl={state.setLogoUrl}
          faviconUrl={state.faviconUrl}
          setFaviconUrl={state.setFaviconUrl}
          primaryColor={state.primaryColor}
          setPrimaryColor={state.setPrimaryColor}
          accentColor={state.accentColor}
          setAccentColor={state.setAccentColor}
          pageTitle={state.pageTitle}
          setPageTitle={state.setPageTitle}
          footerText={state.footerText}
          setFooterText={state.setFooterText}
          brandingSuccess={state.brandingSuccess}
          brandingError={state.brandingError}
          isSavingBranding={state.isSavingBranding}
          onSaveBranding={state.handleSaveBranding}
          onResetDefaults={state.handleResetDefaults}
          primaryContrast={state.primaryContrast}
          formLabels={getBrandingFormLabels(t)}
          previewLabels={getSidePreviewLabels(t)}
        />
      )}

      {state.activeTab === 'preview' && (
        <FullPreviewTab
          agencyName={state.agencyName}
          logoUrl={state.logoUrl}
          primaryColor={state.primaryColor}
          accentColor={state.accentColor}
          pageTitle={state.pageTitle}
          footerText={state.footerText}
          primaryContrast={state.primaryContrast}
          labels={getFullPreviewLabels(t)}
        />
      )}
    </div>
  );
}

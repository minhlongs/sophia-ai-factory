/**
 * White-Label Manager Custom Hook for State & Action Dispatch.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/use-white-label-state
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SaveWhiteLabelBrandingInput } from '@/seed/types/custom-domains';
import { computeContrastColor } from '@/tree/branding/theme-resolver';
import type { WhiteLabelManagerProps, WhiteLabelTab } from './types';
import { useDomainActions } from './use-domain-actions';

export function useWhiteLabelState({
  orgId,
  initialDomains = [],
  initialBranding = null,
  actions,
}: WhiteLabelManagerProps) {
  const t = useTranslations('whiteLabel');

  const domainState = useDomainActions({
    orgId,
    initialDomains,
    actions,
    t,
  });

  const [agencyName, setAgencyName] = useState(initialBranding?.agencyName ?? '');
  const [logoUrl, setLogoUrl] = useState(initialBranding?.logoUrl ?? '');
  const [faviconUrl, setFaviconUrl] = useState(initialBranding?.faviconUrl ?? '');
  const [primaryColor, setPrimaryColor] = useState(initialBranding?.primaryColor ?? '#6366F1');
  const [accentColor, setAccentColor] = useState(initialBranding?.accentColor ?? '#F59E0B');
  const [pageTitle, setPageTitle] = useState(initialBranding?.pageTitle ?? '');
  const [footerText, setFooterText] = useState(initialBranding?.footerText ?? '');

  const [brandingSuccess, setBrandingSuccess] = useState<string | null>(null);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  const [activeTab, setActiveTab] = useState<WhiteLabelTab>('domains');

  const primaryContrast = computeContrastColor(primaryColor);
  const accentContrast = computeContrastColor(accentColor);

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandingError(null);
    setBrandingSuccess(null);
    setIsSavingBranding(true);
    const payload: SaveWhiteLabelBrandingInput = {
      agencyName: agencyName.trim() || null,
      logoUrl: logoUrl.trim() || null,
      faviconUrl: faviconUrl.trim() || null,
      primaryColor,
      accentColor,
      pageTitle: pageTitle.trim() || null,
      footerText: footerText.trim() || null,
    };
    try {
      if (!actions?.saveWhiteLabelBrandingSettings) {
        setBrandingError(t('errors.saveFailed'));
        return;
      }
      const res = await actions.saveWhiteLabelBrandingSettings(orgId, payload);
      if (res.ok) {
        setBrandingSuccess(t('branding.actions.saved'));
      } else {
        setBrandingError(res.error.message || t('errors.saveFailed'));
      }
    } finally {
      setIsSavingBranding(false);
    }
  };

  const handleResetDefaults = () => {
    setPrimaryColor('#6366F1');
    setAccentColor('#F59E0B');
    setAgencyName('');
    setLogoUrl('');
    setFaviconUrl('');
    setPageTitle('');
    setFooterText('');
    setBrandingSuccess(null);
    setBrandingError(null);
  };

  return {
    t,
    ...domainState,
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
    activeTab,
    setActiveTab,
    primaryContrast,
    accentContrast,
    handleSaveBranding,
    handleResetDefaults,
  };
}

export type WhiteLabelState = ReturnType<typeof useWhiteLabelState>;

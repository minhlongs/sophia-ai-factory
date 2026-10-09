/**
 * White-Label Manager Translation Label Builders.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/white-label-labels
 */

import type {
  HeaderTabLabels,
  DomainsTabLabels,
  BrandingFormLabels,
  SidePreviewLabels,
  FullPreviewLabels,
} from './types';

export function getHeaderTabLabels(t: (key: string) => string): HeaderTabLabels {
  return {
    title: t('title'),
    subtitle: t('subtitle'),
    domains: t('tabs.domains'),
    branding: t('tabs.branding'),
    preview: t('tabs.preview'),
  };
}

export function getDomainsTabLabels(t: (key: string) => string): DomainsTabLabels {
  return {
    add: {
      addButton: t('domains.addButton'),
      description: t('domains.description'),
      inputPlaceholder: t('domains.inputPlaceholder'),
      adding: t('domains.adding'),
    },
    list: {
      title: t('domains.listTitle'),
      emptyTitle: t('domains.emptyTitle'),
      emptyDescription: t('domains.emptyDescription'),
    },
    status: {
      active: t('domains.status.active'),
      pendingValidation: t('domains.status.pendingValidation'),
      pendingDeployment: t('domains.status.pendingDeployment'),
      error: t('domains.status.error'),
      verified: t('domains.status.verified'),
      pending: t('domains.status.pending'),
    },
    actions: {
      verifying: t('domains.actions.verifying'),
      verify: t('domains.actions.verify'),
      deleting: t('domains.actions.deleting'),
      delete: t('domains.actions.delete'),
    },
    dnsInstructions: {
      title: t('domains.dnsInstructions.title'),
      cnameHost: t('domains.dnsInstructions.cnameHost'),
      cnameTarget: t('domains.dnsInstructions.cnameTarget'),
    },
  };
}

export function getBrandingFormLabels(t: (key: string) => string): BrandingFormLabels {
  return {
    title: t('branding.title'),
    description: t('branding.description'),
    fields: {
      agencyName: t('branding.fields.agencyName'),
      agencyNamePlaceholder: t('branding.fields.agencyNamePlaceholder'),
      logoUrl: t('branding.fields.logoUrl'),
      logoUrlPlaceholder: t('branding.fields.logoUrlPlaceholder'),
      faviconUrl: t('branding.fields.faviconUrl'),
      faviconUrlPlaceholder: t('branding.fields.faviconUrlPlaceholder'),
      primaryColor: t('branding.fields.primaryColor'),
      primaryColorHelp: t('branding.fields.primaryColorHelp'),
      accentColor: t('branding.fields.accentColor'),
      accentColorHelp: t('branding.fields.accentColorHelp'),
      pageTitle: t('branding.fields.pageTitle'),
      pageTitlePlaceholder: t('branding.fields.pageTitlePlaceholder'),
      footerText: t('branding.fields.footerText'),
      footerTextPlaceholder: t('branding.fields.footerTextPlaceholder'),
    },
    actions: {
      reset: t('branding.actions.reset'),
      save: t('branding.actions.save'),
      saving: t('branding.actions.saving'),
    },
  };
}

export function getSidePreviewLabels(t: (key: string) => string): SidePreviewLabels {
  return {
    livePreviewTitle: t('branding.livePreviewTitle'),
    livePreviewDescription: t('branding.livePreviewDescription'),
    navHome: t('preview.navHome'),
    navCampaigns: t('preview.navCampaigns'),
    badge: t('preview.badge'),
    heroHeading: t('preview.heroHeading'),
    heroSubheading: t('preview.heroSubheading'),
    primaryCta: t('preview.primaryCta'),
    secondaryCta: t('preview.secondaryCta'),
    sampleCardTitle: t('preview.sampleCardTitle'),
    sampleCardDesc: t('preview.sampleCardDesc'),
  };
}

export function getFullPreviewLabels(t: (key: string) => string): FullPreviewLabels {
  return {
    title: t('preview.title'),
    subtitle: t('preview.subtitle'),
    navHome: t('preview.navHome'),
    navCampaigns: t('preview.navCampaigns'),
    navAnalytics: t('preview.navAnalytics'),
    badge: t('preview.badge'),
    heroHeading: t('preview.heroHeading'),
    heroSubheading: t('preview.heroSubheading'),
    primaryCta: t('preview.primaryCta'),
    secondaryCta: t('preview.secondaryCta'),
    sampleCardTitle: t('preview.sampleCardTitle'),
    sampleCardDesc: t('preview.sampleCardDesc'),
  };
}

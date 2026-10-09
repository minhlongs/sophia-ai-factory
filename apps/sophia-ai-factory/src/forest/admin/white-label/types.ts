/**
 * White-Label Manager Types and Constants.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/types
 */

import type {
  CustomDomainRecord,
  CustomDomainError,
  DomainVerificationResult,
  WhiteLabelBrandingSettings,
  SaveWhiteLabelBrandingInput,
  WhiteLabelActionError,
} from '@/seed/types/custom-domains';
import type { Result } from '@/seed/types/result';

export type WhiteLabelTab = 'domains' | 'branding' | 'preview';

export interface WhiteLabelManagerActions {
  registerCustomDomain?: (
    orgId: string,
    rawHostname: string,
  ) => Promise<Result<CustomDomainRecord, CustomDomainError>>;
  verifyCustomDomainStatus?: (
    orgId: string,
    domainId: string,
  ) => Promise<Result<DomainVerificationResult, CustomDomainError>>;
  deleteCustomDomain?: (
    orgId: string,
    domainId: string,
  ) => Promise<Result<{ success: boolean; domainId: string }, CustomDomainError>>;
  saveWhiteLabelBrandingSettings?: (
    orgId: string,
    input: SaveWhiteLabelBrandingInput,
  ) => Promise<Result<WhiteLabelBrandingSettings, WhiteLabelActionError>>;
}

export interface WhiteLabelManagerProps {
  orgId: string;
  initialDomains?: CustomDomainRecord[];
  initialBranding?: Partial<WhiteLabelBrandingSettings> | null;
  actions?: WhiteLabelManagerActions;
}

export interface ColorSwatch {
  name: string;
  hex: string;
}

export interface HeaderTabLabels {
  title: string;
  subtitle: string;
  domains: string;
  branding: string;
  preview: string;
}

export interface DomainsTabLabels {
  add: {
    addButton: string;
    description: string;
    inputPlaceholder: string;
    adding: string;
  };
  list: {
    title: string;
    emptyTitle: string;
    emptyDescription: string;
  };
  status: Record<
    'active' | 'pendingValidation' | 'pendingDeployment' | 'error' | 'verified' | 'pending',
    string
  >;
  actions: Record<'verifying' | 'verify' | 'deleting' | 'delete', string>;
  dnsInstructions: Record<'title' | 'cnameHost' | 'cnameTarget', string>;
}

export interface SidePreviewLabels {
  livePreviewTitle: string;
  livePreviewDescription: string;
  navHome: string;
  navCampaigns: string;
  badge: string;
  heroHeading: string;
  heroSubheading: string;
  primaryCta: string;
  secondaryCta: string;
  sampleCardTitle: string;
  sampleCardDesc: string;
}

export interface FullPreviewLabels {
  title: string;
  subtitle: string;
  navHome: string;
  navCampaigns: string;
  navAnalytics: string;
  badge: string;
  heroHeading: string;
  heroSubheading: string;
  primaryCta: string;
  secondaryCta: string;
  sampleCardTitle: string;
  sampleCardDesc: string;
}

export interface BrandingFormLabels {
  title: string;
  description: string;
  fields: {
    agencyName: string;
    agencyNamePlaceholder: string;
    logoUrl: string;
    logoUrlPlaceholder: string;
    faviconUrl: string;
    faviconUrlPlaceholder: string;
    primaryColor: string;
    primaryColorHelp: string;
    accentColor: string;
    accentColorHelp: string;
    pageTitle: string;
    pageTitlePlaceholder: string;
    footerText: string;
    footerTextPlaceholder: string;
  };
  actions: {
    reset: string;
    save: string;
    saving: string;
  };
}

export const PRESET_SWATCHES: ColorSwatch[] = [
  { name: 'Electric Indigo', hex: '#6366F1' },
  { name: 'Purple Royalty', hex: '#7C3AED' },
  { name: 'Emerald Mint', hex: '#10B981' },
  { name: 'Crimson Rose', hex: '#F43F5E' },
  { name: 'Cyber Amber', hex: '#F59E0B' },
  { name: 'Neon Cyan', hex: '#06B6D4' },
];

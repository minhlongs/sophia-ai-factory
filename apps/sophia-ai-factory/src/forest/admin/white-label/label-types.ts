/**
 * White-Label Manager Preview, Branding Form, and Preset Swatch Types.
 *
 * Layer: forest (UI component composition)
 * @module forest/admin/white-label/label-types
 */

export interface ColorSwatch {
  name: string;
  hex: string;
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

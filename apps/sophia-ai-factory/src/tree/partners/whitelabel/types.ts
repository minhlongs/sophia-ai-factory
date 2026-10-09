/**
 * White-Label Client Portal & Domain Federation Types.
 *
 * Layer: tree/partners/whitelabel
 *
 * @module tree/partners/whitelabel/types
 */

/**
 * Resolved Unbranded Agency Configuration for White-Label Client Portals
 */
export interface UnbrandedAgencyPortalConfig {
  partnerId: string;
  agencySlug: string;
  agencyName: string;
  brandName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  customDomain: string | null;
  customEmailSender: string | null;
  supportUrl: string | null;
  footerHtml: string | null;
  portalTitle: string;
  loginHeadline: string | null;
  loginSubheading: string | null;
  customCss: string | null;
  isSslActive: boolean;
}

export interface WhitelabelThemeInput {
  primaryColor?: string;
  accentColor?: string;
  secondaryColor?: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  brandName?: string;
  agencyName?: string;
  agencySlug?: string;
  agency_slug?: string;
  supportEmail?: string | null;
  customCss?: string | null;
  fontFamily?: string;
  portalTitle?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  brand_name?: string;
  agency_name?: string;
  support_email?: string | null;
  support_url?: string | null;
  supportUrl?: string | null;
  footerHtml?: string | null;
  footer_html?: string | null;
  custom_css?: string | null;
  portal_title?: string;
  loginHeadline?: string | null;
  login_headline?: string | null;
  loginSubheading?: string | null;
  login_subheading?: string | null;
  isSslActive?: boolean;
  is_ssl_active?: number;
}

/**
 * Metadata configuration for 100% unbranded portal views
 */
export interface UnbrandedPortalMetadata {
  title: string;
  description: string;
  icons: {
    icon: string;
    shortcut?: string;
    apple?: string;
  };
  openGraph: {
    title: string;
    description: string;
    siteName: string;
    images: Array<{ url: string }>;
    type: string;
  };
  robots: {
    index: boolean;
    follow: boolean;
  };
  alternates?: {
    canonical?: string;
    languages?: Record<string, string>;
  };
}

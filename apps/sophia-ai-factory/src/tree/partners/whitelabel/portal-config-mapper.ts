/**
 * White-Label Portal Config Mapper Utilities.
 *
 * Layer: tree/partners/whitelabel
 *
 * @module tree/partners/whitelabel/portal-config-mapper
 */

import type { UnbrandedAgencyPortalConfig } from './types';
import { validateHexColor } from './color-validator';

export interface BaseWhitelabelRow {
  id?: string;
  partner_id: string;
  brand_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  custom_domain: string | null;
  custom_email_sender: string | null;
  support_url: string | null;
  footer_html: string | null;
  is_ssl_active: number;
  agency_slug: string | null;
  portal_title: string | null;
  login_headline: string | null;
  login_subheading: string | null;
  custom_css: string | null;
  org_name?: string | null;
  partner_name?: string | null;
}

export interface BaseOrgRow {
  id?: string;
  partner_id: string;
  name: string;
  slug: string | null;
  custom_domain: string | null;
  whitelabel_config_json: string | null;
  status: string;
  pwc_brand_name?: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  custom_email_sender: string | null;
  support_url: string | null;
  footer_html: string | null;
  is_ssl_active: number | null;
  portal_title?: string | null;
  login_headline?: string | null;
  login_subheading?: string | null;
  custom_css?: string | null;
}

/**
 * Maps a partner_whitelabel_configs database row to UnbrandedAgencyPortalConfig.
 */
export function mapWhitelabelRowToConfig(row: BaseWhitelabelRow): UnbrandedAgencyPortalConfig {
  const brand = row.brand_name?.trim() || row.org_name || row.partner_name || 'Agency Portal';
  const slug =
    row.agency_slug ||
    brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
    'agency';

  return {
    partnerId: row.partner_id,
    agencySlug: slug,
    agencyName: row.org_name || row.partner_name || brand,
    brandName: brand,
    logoUrl: row.logo_url,
    faviconUrl: row.favicon_url,
    primaryColor: validateHexColor(row.primary_color, '#06b6d4'),
    secondaryColor: validateHexColor(row.accent_color, '#3b82f6'),
    customDomain: row.custom_domain,
    customEmailSender: row.custom_email_sender,
    supportUrl: row.support_url,
    footerHtml: row.footer_html,
    portalTitle: row.portal_title || brand,
    loginHeadline: row.login_headline,
    loginSubheading: row.login_subheading,
    customCss: row.custom_css,
    isSslActive: row.is_ssl_active === 1,
  };
}

/**
 * Maps a partner_organizations database row to UnbrandedAgencyPortalConfig.
 */
export function mapOrgRowToConfig(
  orgRow: BaseOrgRow,
  fallbackSlug?: string,
): UnbrandedAgencyPortalConfig {
  let parsedJson: Record<string, unknown> = {};
  try {
    if (orgRow.whitelabel_config_json) {
      parsedJson = JSON.parse(orgRow.whitelabel_config_json) as Record<string, unknown>;
    }
  } catch {
    parsedJson = {};
  }

  const brand =
    (typeof parsedJson.brandName === 'string' && parsedJson.brandName.trim()) ||
    orgRow.pwc_brand_name ||
    orgRow.name;

  const slug =
    orgRow.slug ||
    fallbackSlug ||
    brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
    'agency';

  return {
    partnerId: orgRow.partner_id,
    agencySlug: slug,
    agencyName: orgRow.name,
    brandName: brand,
    logoUrl: (parsedJson.logoUrl as string) || orgRow.logo_url || null,
    faviconUrl: (parsedJson.faviconUrl as string) || orgRow.favicon_url || null,
    primaryColor: validateHexColor(
      (parsedJson.primaryColor as string) || orgRow.primary_color,
      '#06b6d4',
    ),
    secondaryColor: validateHexColor(
      (parsedJson.secondaryColor as string) || orgRow.accent_color,
      '#3b82f6',
    ),
    customDomain: orgRow.custom_domain,
    customEmailSender:
      (parsedJson.customEmailSender as string) || orgRow.custom_email_sender || null,
    supportUrl: (parsedJson.supportUrl as string) || orgRow.support_url || null,
    footerHtml: (parsedJson.footerHtml as string) || orgRow.footer_html || null,
    portalTitle: (parsedJson.portalTitle as string) || orgRow.portal_title || brand,
    loginHeadline: (parsedJson.loginHeadline as string) || orgRow.login_headline || null,
    loginSubheading: (parsedJson.loginSubheading as string) || orgRow.login_subheading || null,
    customCss: (parsedJson.customCss as string) || orgRow.custom_css || null,
    isSslActive: orgRow.is_ssl_active === 1,
  };
}

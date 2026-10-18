/**
 * Database Row Interfaces for White-Label Portal Config Mapping.
 *
 * Layer: tree/partners/whitelabel
 *
 * @module tree/partners/whitelabel/portal-config-rows
 */

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

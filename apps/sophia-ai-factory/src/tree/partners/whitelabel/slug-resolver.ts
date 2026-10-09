/**
 * White-Label Agency Resolution by Slug.
 *
 * Layer: tree/partners/whitelabel
 *
 * @module tree/partners/whitelabel/slug-resolver
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { UnbrandedAgencyPortalConfig } from './types';
import {
  type BaseWhitelabelRow,
  type BaseOrgRow,
  mapWhitelabelRowToConfig,
  mapOrgRowToConfig,
} from './portal-config-mapper';

async function queryOrgBySlug(
  db: D1Database,
  cleanSlug: string,
): Promise<UnbrandedAgencyPortalConfig | null> {
  try {
    const orgRow = await db
      .prepare(
        `SELECT
          po.id,
          po.partner_id,
          po.name,
          po.slug,
          po.custom_domain,
          po.whitelabel_config_json,
          po.status,
          pwc.brand_name as pwc_brand_name,
          pwc.logo_url,
          pwc.favicon_url,
          pwc.primary_color,
          pwc.accent_color,
          pwc.custom_email_sender,
          pwc.support_url,
          pwc.footer_html,
          pwc.is_ssl_active,
          pwc.portal_title,
          pwc.login_headline,
          pwc.login_subheading,
          pwc.custom_css
        FROM partner_organizations po
        LEFT JOIN partner_whitelabel_configs pwc ON pwc.partner_id = po.partner_id
        WHERE (LOWER(po.slug) = ?1 OR LOWER(pwc.agency_slug) = ?1) AND po.status = 'active'
        LIMIT 1`
      )
      .bind(cleanSlug)
      .first<BaseOrgRow>();

    if (orgRow) {
      return mapOrgRowToConfig(orgRow, cleanSlug);
    }
  } catch {
    // Proceed to check partner_whitelabel_configs
  }
  return null;
}

async function queryWhitelabelConfigBySlug(
  db: D1Database,
  cleanSlug: string,
): Promise<UnbrandedAgencyPortalConfig | null> {
  try {
    const whitelabelRow = await db
      .prepare(
        `SELECT
          pwc.id,
          pwc.partner_id,
          pwc.brand_name,
          pwc.logo_url,
          pwc.favicon_url,
          pwc.primary_color,
          pwc.accent_color,
          pwc.custom_domain,
          pwc.custom_email_sender,
          pwc.support_url,
          pwc.footer_html,
          pwc.is_ssl_active,
          pwc.agency_slug,
          pwc.portal_title,
          pwc.login_headline,
          pwc.login_subheading,
          pwc.custom_css,
          pp.partner_name
        FROM partner_whitelabel_configs pwc
        LEFT JOIN partner_profiles pp ON pp.id = pwc.partner_id
        WHERE LOWER(pwc.agency_slug) = ?1
        LIMIT 1`
      )
      .bind(cleanSlug)
      .first<BaseWhitelabelRow>();

    if (whitelabelRow) {
      return mapWhitelabelRowToConfig(whitelabelRow);
    }
  } catch {
    // Not found
  }
  return null;
}

/**
 * Resolves an agency's white-label configuration by agency slug (/portal/[agencySlug]).
 *
 * @param db D1Database binding
 * @param slug Agency URL slug (e.g. "apex-marketing")
 */
export async function resolveAgencyBySlug(
  db: D1Database,
  slug: string,
): Promise<UnbrandedAgencyPortalConfig | null> {
  const cleanSlug = (slug || '').trim().toLowerCase();
  if (!cleanSlug) {
    return null;
  }

  // 1. Check partner_organizations joined with partner_whitelabel_configs by slug
  const fromOrg = await queryOrgBySlug(db, cleanSlug);
  if (fromOrg) {
    return fromOrg;
  }

  // 2. Check partner_whitelabel_configs by agency_slug
  return queryWhitelabelConfigBySlug(db, cleanSlug);
}

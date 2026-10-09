/**
 * White-Label Agency Resolution by Custom Domain / CNAME.
 *
 * Layer: tree/partners/whitelabel
 *
 * @module tree/partners/whitelabel/domain-resolver
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { UnbrandedAgencyPortalConfig } from './types';
import {
  type BaseWhitelabelRow,
  type BaseOrgRow,
  mapWhitelabelRowToConfig,
  mapOrgRowToConfig,
} from './portal-config-mapper';

async function queryWhitelabelConfigByDomain(
  db: D1Database,
  cleanHost: string,
): Promise<UnbrandedAgencyPortalConfig | null> {
  try {
    const row = await db
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
          COALESCE(pwc.agency_slug, po.slug) as agency_slug,
          COALESCE(pwc.portal_title, pwc.brand_name) as portal_title,
          pwc.login_headline,
          pwc.login_subheading,
          pwc.custom_css,
          po.name as org_name
        FROM partner_whitelabel_configs pwc
        LEFT JOIN partner_organizations po ON po.partner_id = pwc.partner_id
        WHERE LOWER(pwc.custom_domain) = ?1 AND pwc.is_ssl_active = 1
        LIMIT 1`
      )
      .bind(cleanHost)
      .first<BaseWhitelabelRow>();

    if (row) {
      return mapWhitelabelRowToConfig(row);
    }
  } catch {
    // Fallback to partner_organizations
  }
  return null;
}

async function queryOrgByDomain(
  db: D1Database,
  cleanHost: string,
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
          pwc.logo_url,
          pwc.favicon_url,
          pwc.primary_color,
          pwc.accent_color,
          pwc.custom_email_sender,
          pwc.support_url,
          pwc.footer_html,
          pwc.is_ssl_active
        FROM partner_organizations po
        LEFT JOIN partner_whitelabel_configs pwc ON pwc.partner_id = po.partner_id
        WHERE LOWER(po.custom_domain) = ?1 AND po.status = 'active'
        LIMIT 1`
      )
      .bind(cleanHost)
      .first<BaseOrgRow>();

    if (orgRow) {
      return mapOrgRowToConfig(orgRow);
    }
  } catch {
    // Return null if table query fails
  }
  return null;
}

/**
 * Resolves an agency's white-label configuration by custom domain / CNAME hostname.
 * Queries partner_whitelabel_configs or partner_organizations in D1.
 *
 * @param db D1Database binding
 * @param hostname Incoming Host header (e.g. "portal.apexmarketing.com")
 */
export async function resolveAgencyByDomain(
  db: D1Database,
  hostname: string,
): Promise<UnbrandedAgencyPortalConfig | null> {
  const cleanHost = (hostname || '').trim().toLowerCase();
  if (!cleanHost || cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
    return null;
  }

  // 1. Query partner_whitelabel_configs where custom_domain matches and SSL is active
  const fromWhitelabel = await queryWhitelabelConfigByDomain(db, cleanHost);
  if (fromWhitelabel) {
    return fromWhitelabel;
  }

  // 2. Query partner_organizations by custom_domain where status is 'active'
  return queryOrgByDomain(db, cleanHost);
}

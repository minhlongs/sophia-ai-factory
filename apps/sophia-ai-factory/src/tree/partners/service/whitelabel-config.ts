/**
 * Partner White-Label Branding Configuration.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/service/whitelabel-config
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerWhitelabelConfig,
  WhitelabelConfigInput,
  WhitelabelCssTheme,
} from '@/tree/partners/types';
import { getPartnerById } from './partner-profile';
import { generateDnsTxtVerificationToken } from './domain-dns';
import { resolveWhitelabelTheme } from './theme-sanitizer';

/**
 * Fetch white-label config by partner ID.
 */
export async function getWhitelabelConfigByPartnerId(
  db: D1Database,
  partnerId: string,
): Promise<PartnerWhitelabelConfig | null> {
  const row = await db
    .prepare('SELECT * FROM partner_whitelabel_configs WHERE partner_id = ?1 LIMIT 1')
    .bind(partnerId)
    .first<PartnerWhitelabelConfig>();
  return row ?? null;
}

async function updateExistingWhitelabelConfig(
  db: D1Database,
  existingConfig: PartnerWhitelabelConfig,
  input: WhitelabelConfigInput,
  cleanDomain: string | null,
  verificationToken: string | null,
  nowMs: number,
): Promise<void> {
  const isNewDomain = cleanDomain && cleanDomain !== existingConfig.custom_domain;
  const isSslActive = isNewDomain ? 0 : existingConfig.is_ssl_active;
  const dnsVerifiedAt = isNewDomain ? null : existingConfig.dns_verified_at;
  const token = isNewDomain ? verificationToken : existingConfig.dns_txt_verification_token;

  await db
    .prepare(
      `UPDATE partner_whitelabel_configs
       SET brand_name = ?1,
           logo_url = ?2,
           favicon_url = ?3,
           primary_color = ?4,
           accent_color = ?5,
           custom_domain = ?6,
           custom_email_sender = ?7,
           support_url = ?8,
           footer_html = ?9,
           is_ssl_active = ?10,
           dns_txt_verification_token = ?11,
           dns_verified_at = ?12,
           updated_at = ?13
       WHERE id = ?14`
    )
    .bind(
      input.brandName.trim(),
      input.logoUrl ?? null,
      input.faviconUrl ?? null,
      input.primaryColor || '#06b6d4',
      input.accentColor || '#3b82f6',
      cleanDomain,
      input.customEmailSender ?? null,
      input.supportUrl ?? null,
      input.footerHtml ?? null,
      isSslActive,
      token,
      dnsVerifiedAt,
      nowMs,
      existingConfig.id,
    )
    .run();
}

async function insertNewWhitelabelConfig(
  db: D1Database,
  input: WhitelabelConfigInput,
  cleanDomain: string | null,
  verificationToken: string | null,
  nowMs: number,
): Promise<void> {
  const id = `wlc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await db
    .prepare(
      `INSERT INTO partner_whitelabel_configs (
        id, partner_id, brand_name, logo_url, favicon_url, primary_color, accent_color,
        custom_domain, custom_email_sender, support_url, footer_html, is_ssl_active,
        dns_txt_verification_token, dns_verified_at, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, ?12, NULL, ?13, ?13)`
    )
    .bind(
      id,
      input.partnerId,
      input.brandName.trim(),
      input.logoUrl ?? null,
      input.faviconUrl ?? null,
      input.primaryColor || '#06b6d4',
      input.accentColor || '#3b82f6',
      cleanDomain,
      input.customEmailSender ?? null,
      input.supportUrl ?? null,
      input.footerHtml ?? null,
      verificationToken,
      nowMs,
    )
    .run();
}

/**
 * Configure or update white-label branding assets.
 * Requires partner to have whitelabel_enabled = 1 (PLATINUM tier).
 */
export async function upsertWhitelabelConfig(
  db: D1Database,
  input: WhitelabelConfigInput,
  nowMs = Date.now(),
): Promise<PartnerWhitelabelConfig> {
  const partner = await getPartnerById(db, input.partnerId);
  if (!partner) {
    throw new Error(`Partner not found: ${input.partnerId}`);
  }

  if (partner.whitelabel_enabled !== 1 && partner.tier !== 'PLATINUM') {
    throw new Error(
      'WHITELABEL_NOT_PERMITTED: White-label customization is exclusive to PLATINUM tier partners (30+ customers or $20k+ MRR)',
    );
  }

  const cleanDomain = input.customDomain?.trim().toLowerCase() || null;
  const verificationToken = cleanDomain
    ? generateDnsTxtVerificationToken(input.partnerId, cleanDomain)
    : null;

  const existingConfig = await getWhitelabelConfigByPartnerId(db, input.partnerId);

  if (existingConfig) {
    await updateExistingWhitelabelConfig(db, existingConfig, input, cleanDomain, verificationToken, nowMs);
  } else {
    await insertNewWhitelabelConfig(db, input, cleanDomain, verificationToken, nowMs);
  }

  if (cleanDomain) {
    await db
      .prepare('UPDATE partner_profiles SET custom_domain = ?1, updated_at = ?2 WHERE id = ?3')
      .bind(cleanDomain, nowMs, input.partnerId)
      .run();
  }

  const result = await getWhitelabelConfigByPartnerId(db, input.partnerId);
  if (!result) throw new Error('Failed to retrieve white-label config');
  return result;
}

/**
 * Resolves white-label config & CSS theme by host/domain for edge branding injection.
 */
export async function resolveWhitelabelByDomain(
  db: D1Database,
  domain: string,
): Promise<{ config: PartnerWhitelabelConfig; theme: WhitelabelCssTheme } | null> {
  const cleanDomain = domain.toLowerCase().trim();
  const row = await db
    .prepare(
      `SELECT * FROM partner_whitelabel_configs
       WHERE custom_domain = ?1 AND is_ssl_active = 1
       LIMIT 1`
    )
    .bind(cleanDomain)
    .first<PartnerWhitelabelConfig>();

  if (!row) {
    return null;
  }

  return {
    config: row,
    theme: resolveWhitelabelTheme(row),
  };
}

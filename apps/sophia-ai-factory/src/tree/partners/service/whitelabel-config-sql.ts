/**
 * D1 SQL statement helpers for Partner White-Label Branding Configuration.
 * @module tree/partners/service/whitelabel-config-sql
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerWhitelabelConfig,
  WhitelabelConfigInput,
} from '@/tree/partners/types';

export async function updateExistingWhitelabelConfig(
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
       WHERE id = ?14`,
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

export async function insertNewWhitelabelConfig(
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
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, ?12, NULL, ?13, ?13)`,
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

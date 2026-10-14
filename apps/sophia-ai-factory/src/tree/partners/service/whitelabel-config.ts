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
import {
  updateExistingWhitelabelConfig,
  insertNewWhitelabelConfig,
} from './whitelabel-config-sql';

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
       LIMIT 1`,
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

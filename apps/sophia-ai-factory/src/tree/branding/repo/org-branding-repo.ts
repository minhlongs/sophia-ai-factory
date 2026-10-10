/**
 * D1 Database repository for organization branding and author settings.
 *
 * Layer: tree/branding/repo
 * Allowed imports: @/seed/*
 */

import { logger } from '@/seed/utils/logger-utility';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import type {
  OrgBrandingRow,
  OrgBrandingInput,
} from './types';
import {
  validatePosition,
  validatePolicy,
  clampOpacity,
} from './asset-validator';
import { getTenantBrandingByHostname } from './hostname-resolver';

export async function getOrgBranding(
  db: D1Database,
  orgId: string,
): Promise<OrgBrandingRow | null> {
  try {
    const row = await db
      .prepare(`SELECT * FROM org_branding WHERE org_id = ?1 LIMIT 1`)
      .bind(orgId)
      .first<OrgBrandingRow>();
    return row ?? null;
  } catch (err) {
    logger.warn('[OrgBranding] read failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function upsertOrgBranding(
  db: D1Database,
  orgId: string,
  input: OrgBrandingInput,
): Promise<OrgBrandingRow> {
  const existing = await getOrgBranding(db, orgId);
  const now = Math.floor(Date.now() / 1000);

  const merged: OrgBrandingRow = {
    org_id: orgId,
    agency_name: input.agencyName ?? existing?.agency_name ?? null,
    logo_url: input.logoUrl ?? existing?.logo_url ?? null,
    watermark_position: validatePosition(input.watermarkPosition ?? existing?.watermark_position),
    watermark_opacity: clampOpacity(input.watermarkOpacity ?? existing?.watermark_opacity ?? 0.85),
    watermark_policy: validatePolicy(input.watermarkPolicy ?? existing?.watermark_policy),
    primary_color: input.primaryColor ?? existing?.primary_color ?? null,
    updated_at: now,
    created_at: existing?.created_at ?? now,
  };

  await db
    .prepare(
      `INSERT INTO org_branding
         (org_id, agency_name, logo_url, watermark_position, watermark_opacity,
          watermark_policy, primary_color, updated_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(org_id) DO UPDATE SET
         agency_name        = excluded.agency_name,
         logo_url           = excluded.logo_url,
         watermark_position = excluded.watermark_position,
         watermark_opacity  = excluded.watermark_opacity,
         watermark_policy   = excluded.watermark_policy,
         primary_color      = excluded.primary_color,
         updated_at         = excluded.updated_at`,
    )
    .bind(
      merged.org_id, merged.agency_name, merged.logo_url,
      merged.watermark_position, merged.watermark_opacity,
      merged.watermark_policy, merged.primary_color,
      merged.updated_at, merged.created_at,
    )
    .run();

  return merged;
}

/**
 * Batch-fetch tenant branding settings for a set of user IDs.
 * Returns a map of userId -> BrandingSettings (or null if not set).
 */
export async function fetchAuthorBrandings(
  db: D1Database,
  userIds: string[],
): Promise<Map<string, BrandingSettings | null>> {
  const result = new Map<string, BrandingSettings | null>();
  if (userIds.length === 0) return result;

  for (const uid of userIds) result.set(uid, null);

  try {
    const placeholders = userIds.map((_, i) => `?${i + 1}`).join(',');
    const sql = `SELECT tenant_id, value FROM tenant_settings WHERE tenant_id IN (${placeholders}) AND namespace = 'branding'`;
    const { results } = await db.prepare(sql).bind(...userIds).all<{ tenant_id: string; value: string }>();
    for (const row of results ?? []) {
      try {
        const parsed = JSON.parse(row.value) as BrandingSettings;
        result.set(row.tenant_id, parsed);
      } catch {
        // malformed JSON — keep null
      }
    }
  } catch (err) {
    logger.warn('[fetchAuthorBrandings] batch query failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

export { getTenantBrandingByHostname };

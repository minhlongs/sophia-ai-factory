/**
 * Org branding repository — agency name, logo, watermark policy.
 *
 * Watermark policy:
 *   - 'always'      : agency logo on every video
 *   - 'master_plus' : agency logo only for MASTER (and ENTERPRISE) tier;
 *                     other tiers fall back to Sophia branding
 *   - 'never'       : no watermark
 *
 * @module lib/branding/org-branding-repo
 */

import { logger } from '@/seed/utils/logger-utility';
import type { Tier } from '@/seed/types';

export type WatermarkPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
export type WatermarkPolicy = 'always' | 'master_plus' | 'never';

export interface OrgBrandingRow {
  org_id: string;
  agency_name: string | null;
  logo_url: string | null;
  watermark_position: WatermarkPosition;
  watermark_opacity: number;
  watermark_policy: WatermarkPolicy;
  primary_color: string | null;
  updated_at: number;
  created_at: number;
}

export interface OrgBrandingInput {
  agencyName?: string | null;
  logoUrl?: string | null;
  watermarkPosition?: WatermarkPosition;
  watermarkOpacity?: number;
  watermarkPolicy?: WatermarkPolicy;
  primaryColor?: string | null;
}

const VALID_POSITIONS: WatermarkPosition[] = [
  'bottom-right', 'bottom-left', 'top-right', 'top-left',
];
const VALID_POLICIES: WatermarkPolicy[] = ['always', 'master_plus', 'never'];

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
 * Build the watermark spec passed to the composer based on tier + policy.
 * Returns null when no watermark should be applied.
 */
export function buildWatermarkForTier(
  branding: OrgBrandingRow | null,
  tier: Tier,
): { text?: string; logoUrl?: string; position: WatermarkPosition; opacity: number } | null {
  if (!branding || branding.watermark_policy === 'never') return null;

  const eligible =
    branding.watermark_policy === 'always'
      || (branding.watermark_policy === 'master_plus' && (tier === 'MASTER' || tier === 'ENTERPRISE'));

  if (!eligible) {
    // Sub-master tiers see the default Sophia brand instead of the agency's
    return {
      text: 'Sophia AI',
      position: 'bottom-right',
      opacity: 0.7,
    };
  }

  if (!branding.logo_url && !branding.agency_name) return null;

  return {
    text: branding.agency_name ?? undefined,
    logoUrl: branding.logo_url ?? undefined,
    position: branding.watermark_position,
    opacity: branding.watermark_opacity,
  };
}

function validatePosition(p: WatermarkPosition | undefined): WatermarkPosition {
  return p && VALID_POSITIONS.includes(p) ? p : 'bottom-right';
}

function validatePolicy(p: WatermarkPolicy | undefined): WatermarkPolicy {
  return p && VALID_POLICIES.includes(p) ? p : 'master_plus';
}

function clampOpacity(o: number): number {
  if (Number.isNaN(o)) return 0.85;
  return Math.min(1, Math.max(0, o));
}

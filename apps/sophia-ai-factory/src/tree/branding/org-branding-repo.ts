/**
 * Org branding repository — agency name, logo, watermark policy.
 *
 * Watermark policy:
 *   - 'always'      : agency logo on every video
 *   - 'master_plus' : agency logo only for MASTER (and ENTERPRISE) tier;
 *                     other tiers fall back to Sophia branding
 *   - 'never'       : no watermark
 *
 * @module tree/branding/org-branding-repo
 */

import { logger } from '@/seed/utils/logger-utility';
import type { Tier } from '@/seed/types';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import { DEFAULT_BRANDING } from '@/seed/tenant-settings/defaults';
import type { ResolvedTenantBranding } from '@/seed/types/white-label-branding';

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

  // Initialize all requested IDs to null (will overwrite if found)
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

// ── In-Memory Edge Memoization Cache & Hostname Resolution ───────────────────

// Standard non-whitelabel hostnames that immediately bypass D1 lookup
const CANONICAL_DOMAINS = new Set([
  'sophia.agencyos.network',
  'sophia-ai-factory.agencyos-openclaw.workers.dev',
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
]);

export function isCanonicalHostname(hostname: string): boolean {
  if (!hostname) return true;
  const clean = hostname.toLowerCase().trim().replace(/:\d+$/, '');
  if (CANONICAL_DOMAINS.has(clean)) return true;
  if (clean.endsWith('.workers.dev') || clean.endsWith('.pages.dev') || clean.endsWith('.local')) {
    return true;
  }
  return false;
}

interface CacheEntry {
  data: ResolvedTenantBranding | null;
  expiresAt: number;
}

const EDGE_CACHE_TTL_MS = 60_000; // 60 seconds
const EDGE_CACHE_NEGATIVE_TTL_MS = 15_000; // 15 seconds for non-existent domains
const MAX_CACHE_ENTRIES = 500;
const hostnameBrandingCache = new Map<string, CacheEntry>();

/**
 * Invalidate in-memory branding cache for a specific hostname or org.
 * Should be called when branding or domain verification changes.
 */
export function invalidateTenantBrandingCache(hostname?: string, orgId?: string): void {
  if (hostname) {
    const clean = hostname.toLowerCase().trim().replace(/:\d+$/, '');
    hostnameBrandingCache.delete(clean);
  }
  if (orgId) {
    for (const [key, entry] of hostnameBrandingCache.entries()) {
      if (entry.data?.orgId === orgId) {
        hostnameBrandingCache.delete(key);
      }
    }
  }
  if (!hostname && !orgId) {
    hostnameBrandingCache.clear();
  }
}

export function clearBrandingCache(): void {
  hostnameBrandingCache.clear();
}

/**
 * Resolves full white-label tenant branding by hostname.
 * Joins custom_domains with org_branding and tenant_settings.
 * Uses in-memory edge memoization for rapid SSR theme resolution.
 * Returns null if the hostname is canonical or domain is not verified.
 */
export async function getTenantBrandingByHostname(
  db: D1Database,
  rawHostname: string,
): Promise<ResolvedTenantBranding | null> {
  const hostname = rawHostname.toLowerCase().trim().replace(/:\d+$/, '');

  // 1. Fast path: bypass canonical Sophia domains without D1 query
  if (isCanonicalHostname(hostname)) {
    return null;
  }

  // 2. Fast path: check in-memory edge memoization
  const now = Date.now();
  const cached = hostnameBrandingCache.get(hostname);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // 3. Query D1: Join custom_domains with org_branding & tenant_settings
  try {
    const sql = `
      SELECT 
        cd.id AS domain_id,
        cd.org_id,
        cd.hostname,
        cd.ssl_status,
        cd.verification_status,
        cd.active,
        ob.agency_name,
        ob.logo_url,
        ob.primary_color,
        ob.watermark_position,
        ob.watermark_opacity,
        ob.watermark_policy,
        ts.value AS tenant_settings_value
      FROM custom_domains cd
      LEFT JOIN org_branding ob ON cd.org_id = ob.org_id
      LEFT JOIN tenant_settings ts ON cd.org_id = ts.tenant_id AND ts.namespace = 'branding'
      WHERE cd.hostname = ?1 
        AND (cd.active = 1 OR cd.verification_status IN ('verified', 'active') OR cd.ssl_status = 'active')
      LIMIT 1
    `;

    interface QueryRow {
      domain_id: string;
      org_id: string;
      hostname: string;
      ssl_status: string;
      verification_status: string;
      active: number;
      agency_name: string | null;
      logo_url: string | null;
      primary_color: string | null;
      watermark_position: WatermarkPosition | null;
      watermark_opacity: number | null;
      watermark_policy: WatermarkPolicy | null;
      tenant_settings_value: string | null;
    }

    const row = await db.prepare(sql).bind(hostname).first<QueryRow>();

    if (!row) {
      // Store negative cache result to prevent repeated D1 lookups on invalid domains
      if (hostnameBrandingCache.size >= MAX_CACHE_ENTRIES) {
        const firstKey = hostnameBrandingCache.keys().next().value;
        if (firstKey) hostnameBrandingCache.delete(firstKey);
      }
      hostnameBrandingCache.set(hostname, {
        data: null,
        expiresAt: now + EDGE_CACHE_NEGATIVE_TTL_MS,
      });
      return null;
    }

    // Parse JSON settings if present
    let parsedSettings: Partial<BrandingSettings> | null = null;
    if (row.tenant_settings_value) {
      try {
        parsedSettings = JSON.parse(row.tenant_settings_value) as Partial<BrandingSettings>;
      } catch {
        // malformed JSON, proceed with defaults
      }
    }

    const resolved: ResolvedTenantBranding = {
      orgId: row.org_id,
      hostname: row.hostname,
      agencyName: parsedSettings?.agencyName ?? row.agency_name ?? null,
      logoUrl: parsedSettings?.logoUrl ?? row.logo_url ?? null,
      faviconUrl: parsedSettings?.faviconUrl ?? DEFAULT_BRANDING.faviconUrl,
      primaryColor: parsedSettings?.primaryColor ?? row.primary_color ?? DEFAULT_BRANDING.primaryColor,
      accentColor: parsedSettings?.accentColor ?? DEFAULT_BRANDING.accentColor ?? '#F59E0B',
      welcomeMessage: parsedSettings?.welcomeMessage ?? DEFAULT_BRANDING.welcomeMessage,
      emailFromName: parsedSettings?.emailFromName ?? DEFAULT_BRANDING.emailFromName,
      emailFooter: parsedSettings?.emailFooter ?? DEFAULT_BRANDING.emailFooter,
      socialMeta: parsedSettings?.socialMeta ?? DEFAULT_BRANDING.socialMeta,
      watermarkPosition: row.watermark_position ?? 'bottom-right',
      watermarkOpacity: row.watermark_opacity ?? 0.85,
      watermarkPolicy: row.watermark_policy ?? 'master_plus',
      isWhiteLabel: true,
    };

    // Cache warm result
    if (hostnameBrandingCache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = hostnameBrandingCache.keys().next().value;
      if (firstKey) hostnameBrandingCache.delete(firstKey);
    }
    hostnameBrandingCache.set(hostname, {
      data: resolved,
      expiresAt: now + EDGE_CACHE_TTL_MS,
    });

    return resolved;
  } catch (err) {
    logger.warn('[org-branding-repo] getTenantBrandingByHostname failed', {
      hostname,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

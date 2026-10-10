/**
 * Resolves full white-label tenant branding by hostname.
 *
 * Layer: tree/branding/repo
 * Allowed imports: @/seed/*
 */

import { logger } from '@/seed/utils/logger-utility';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import type { ResolvedTenantBranding } from '@/seed/types/white-label-branding';
import {
  type WatermarkPosition,
  type WatermarkPolicy,
  EDGE_CACHE_TTL_MS,
  EDGE_CACHE_NEGATIVE_TTL_MS,
} from './types';
import { isCanonicalHostname } from './asset-validator';
import {
  hostnameBrandingCache,
  trimCacheIfNeeded,
  deriveResolvedBranding,
} from './palette-generator';

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

  if (isCanonicalHostname(hostname)) {
    return null;
  }

  const now = Date.now();
  const cached = hostnameBrandingCache.get(hostname);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

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

    const row = await db.prepare(sql).bind(hostname).first<QueryRow>();

    if (!row) {
      trimCacheIfNeeded();
      hostnameBrandingCache.set(hostname, {
        data: null,
        expiresAt: now + EDGE_CACHE_NEGATIVE_TTL_MS,
      });
      return null;
    }

    let parsedSettings: Partial<BrandingSettings> | null = null;
    if (row.tenant_settings_value) {
      try {
        parsedSettings = JSON.parse(row.tenant_settings_value) as Partial<BrandingSettings>;
      } catch {
        // malformed JSON, proceed with defaults
      }
    }

    const resolved = deriveResolvedBranding(row.org_id, row.hostname, row, parsedSettings);

    trimCacheIfNeeded();
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

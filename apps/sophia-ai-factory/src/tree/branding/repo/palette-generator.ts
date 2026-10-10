/**
 * Palette derivation, contrast utilities, and in-memory edge memoization cache for branding.
 *
 * Layer: tree/branding/repo
 * Allowed imports: @/seed/*
 */

import { DEFAULT_BRANDING, type BrandingSettings } from '@/seed/tenant-settings/defaults';
import type { ResolvedTenantBranding } from '@/seed/types/white-label-branding';
import {
  type CacheEntry,
  type OrgBrandingFields,
  MAX_CACHE_ENTRIES,
} from './types';

export const hostnameBrandingCache = new Map<string, CacheEntry>();

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
 * Evict oldest entry if cache exceeds bounds.
 */
export function trimCacheIfNeeded(): void {
  if (hostnameBrandingCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = hostnameBrandingCache.keys().next().value;
    if (firstKey) hostnameBrandingCache.delete(firstKey);
  }
}

/**
 * Derives full resolved tenant branding tokens combining custom domains, org branding, and settings.
 */
export function deriveResolvedBranding(
  orgId: string,
  hostname: string,
  obRow?: OrgBrandingFields | null,
  parsedSettings?: Partial<BrandingSettings> | null
): ResolvedTenantBranding {
  return {
    orgId,
    hostname,
    agencyName: parsedSettings?.agencyName ?? obRow?.agency_name ?? null,
    logoUrl: parsedSettings?.logoUrl ?? obRow?.logo_url ?? null,
    faviconUrl: parsedSettings?.faviconUrl ?? DEFAULT_BRANDING.faviconUrl,
    primaryColor: parsedSettings?.primaryColor ?? obRow?.primary_color ?? DEFAULT_BRANDING.primaryColor,
    accentColor: parsedSettings?.accentColor ?? DEFAULT_BRANDING.accentColor ?? '#F59E0B',
    welcomeMessage: parsedSettings?.welcomeMessage ?? DEFAULT_BRANDING.welcomeMessage,
    emailFromName: parsedSettings?.emailFromName ?? DEFAULT_BRANDING.emailFromName,
    emailFooter: parsedSettings?.emailFooter ?? DEFAULT_BRANDING.emailFooter,
    socialMeta: parsedSettings?.socialMeta ?? DEFAULT_BRANDING.socialMeta,
    watermarkPosition: obRow?.watermark_position ?? 'bottom-right',
    watermarkOpacity: obRow?.watermark_opacity ?? 0.85,
    watermarkPolicy: obRow?.watermark_policy ?? 'master_plus',
    isWhiteLabel: true,
  };
}

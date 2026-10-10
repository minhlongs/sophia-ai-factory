/**
 * Asset, watermark, and hostname validation rules for org branding.
 *
 * Layer: tree/branding/repo
 * Allowed imports: @/seed/*
 */

import type { Tier } from '@/seed/types';
import {
  type WatermarkPosition,
  type WatermarkPolicy,
  type OrgBrandingRow,
  VALID_POSITIONS,
  VALID_POLICIES,
  CANONICAL_DOMAINS,
} from './types';

export function validatePosition(p: WatermarkPosition | undefined): WatermarkPosition {
  return p && VALID_POSITIONS.includes(p) ? p : 'bottom-right';
}

export function validatePolicy(p: WatermarkPolicy | undefined): WatermarkPolicy {
  return p && VALID_POLICIES.includes(p) ? p : 'master_plus';
}

export function clampOpacity(o: number): number {
  if (Number.isNaN(o)) return 0.85;
  return Math.min(1, Math.max(0, o));
}

/**
 * Standard non-whitelabel hostnames that immediately bypass D1 lookup.
 */
export function isCanonicalHostname(hostname: string): boolean {
  if (!hostname) return true;
  const clean = hostname.toLowerCase().trim().replace(/:\d+$/, '');
  if (CANONICAL_DOMAINS.has(clean)) return true;
  if (clean.endsWith('.workers.dev') || clean.endsWith('.pages.dev') || clean.endsWith('.local')) {
    return true;
  }
  return false;
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

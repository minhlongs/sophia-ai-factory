/**
 * Org branding repository types and configuration.
 *
 * Layer: tree/branding/repo
 * Allowed imports: @/seed/*
 */

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

export interface OrgBrandingFields {
  agency_name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  watermark_position?: WatermarkPosition | null;
  watermark_opacity?: number | null;
  watermark_policy?: WatermarkPolicy | null;
}

export interface OrgBrandingInput {
  agencyName?: string | null;
  logoUrl?: string | null;
  watermarkPosition?: WatermarkPosition;
  watermarkOpacity?: number;
  watermarkPolicy?: WatermarkPolicy;
  primaryColor?: string | null;
}

export interface CacheEntry {
  data: ResolvedTenantBranding | null;
  expiresAt: number;
}

export const VALID_POSITIONS: WatermarkPosition[] = [
  'bottom-right', 'bottom-left', 'top-right', 'top-left',
];

export const VALID_POLICIES: WatermarkPolicy[] = ['always', 'master_plus', 'never'];

export const CANONICAL_DOMAINS = new Set([
  'sophia.agencyos.network',
  'sophia-ai-factory.agencyos-openclaw.workers.dev',
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
]);

export const EDGE_CACHE_TTL_MS = 60_000; // 60 seconds
export const EDGE_CACHE_NEGATIVE_TTL_MS = 15_000; // 15 seconds for non-existent domains
export const MAX_CACHE_ENTRIES = 500;

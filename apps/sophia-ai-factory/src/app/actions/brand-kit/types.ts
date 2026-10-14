/**
 * Types and constants for Brand Kit actions
 *
 * @module app/actions/brand-kit/types
 */

import type { getBrandKit } from '@/seed/db/repositories/brand-kits-repo';

export type BrandKitResult =
  | { success: true; data: Awaited<ReturnType<typeof getBrandKit>> }
  | { success: false; error: string };

export interface SaveBrandKitInput {
  primaryColor?: string;
  secondaryColor?: string;
  logoPosition?: string;
  logoOpacity?: number;
}

export const ALLOWED_ASSET_TYPES = ['logo', 'intro', 'outro', 'font'] as const;
export type AssetType = (typeof ALLOWED_ASSET_TYPES)[number];

export interface AssetLimits {
  maxBytes: number;
  mimePrefix: string;
}

export const ASSET_LIMITS: Record<AssetType, AssetLimits> = {
  logo: { maxBytes: 2 * 1024 * 1024, mimePrefix: 'image/' },
  intro: { maxBytes: 20 * 1024 * 1024, mimePrefix: 'video/' },
  outro: { maxBytes: 20 * 1024 * 1024, mimePrefix: 'video/' },
  font: { maxBytes: 5 * 1024 * 1024, mimePrefix: 'font/' },
};

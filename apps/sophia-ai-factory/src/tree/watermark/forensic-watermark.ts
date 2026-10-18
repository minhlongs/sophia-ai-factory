/**
 * Dynamic Forensic Watermarking Engine
 *
 * Generates semi-transparent, leak-traceable forensic watermarks for video previews and exports.
 * Embeds tenant identifier, hashed user identity, and ISO date timestamp to deter unauthorized
 * recording, screen capture, and asset leakage.
 *
 * Layer: tree/watermark (Pure domain algorithm, zero side-effects)
 * Dependencies: seed/types/streaming (0 forest/land imports)
 *
 * @module tree/watermark/forensic-watermark
 */

import type {
  DynamicForensicWatermarkResult,
} from '@/seed/types/streaming';
import { computeForensicHash, formatDateUtc } from './forensic-hash';

export { computeForensicHash };

export const DEFAULT_FORENSIC_OPACITY = 0.22;
export const DEFAULT_FORENSIC_POSITION = 'bottom-right' as const;

export interface ForensicWatermarkOptions {
  opacity?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  date?: Date;
}

/**
 * Generates a dynamic forensic watermark specification for video playback overlay.
 *
 * @param tenantId - Organization or customer tenant ID
 * @param userId - Unique user identifier
 * @param customText - Optional brand name or watermark notice
 * @param options - Custom opacity, position, and date overrides
 * @returns Complete watermark descriptor with overlayText, opacity, position, and forensicHash
 */
export function generateForensicWatermark(
  tenantId: string,
  userId: string,
  customText?: string,
  options?: ForensicWatermarkOptions
): DynamicForensicWatermarkResult {
  const cleanTenant = (tenantId || 'tenant_default').trim();
  const cleanUser = (userId || 'user_anonymous').trim();
  const forensicHash = computeForensicHash(cleanTenant, cleanUser);

  const dateStr = formatDateUtc(options?.date ?? new Date());
  const tenantBadge = cleanTenant.length > 8 ? cleanTenant.slice(0, 8) : cleanTenant;

  const parts = ['Sophia AI'];
  if (customText && customText.trim().length > 0) {
    parts.push(customText.trim());
  }
  parts.push(`Tenant: ${tenantBadge}`);
  parts.push(`ID: ${forensicHash}`);
  parts.push(dateStr);

  const overlayText = parts.join(' • ');
  const opacity = Math.min(1.0, Math.max(0.05, options?.opacity ?? DEFAULT_FORENSIC_OPACITY));
  const position = options?.position ?? DEFAULT_FORENSIC_POSITION;

  return {
    overlayText,
    opacity,
    position,
    forensicHash,
  };
}

/**
 * Generates the forensic watermark text string.
 * Contract per PROJECT.md § M4 (Edge CDN & HLS) ↔ Storage & Client Player.
 *
 * @param tenantId - Organization or customer tenant ID
 * @param userId - Unique user identifier
 * @param customText - Optional custom string
 * @returns Formatted watermark string
 */
export function generateForensicWatermarkText(
  tenantId: string,
  userId: string,
  customText?: string
): string {
  const result = generateForensicWatermark(tenantId, userId, customText);
  return result.overlayText;
}

/**
 * Validates whether a rendered watermark string contains the forensic hash
 * corresponding to a given tenant and user.
 *
 * @param watermarkText - Captured watermark text
 * @param tenantId - Claimed tenant ID
 * @param userId - Claimed user ID
 * @returns true if the watermark text embeds the authentic forensic hash
 */
export function verifyForensicWatermark(
  watermarkText: string,
  tenantId: string,
  userId: string
): boolean {
  if (!watermarkText || typeof watermarkText !== 'string') {
    return false;
  }
  const expectedHash = computeForensicHash(tenantId, userId);
  return watermarkText.includes(expectedHash);
}

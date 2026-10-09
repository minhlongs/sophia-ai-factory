/**
 * Tenant Asset Key Formatter for Multi-Track Media Vaulting.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 *
 * @module forest/mission/orchestrator/asset-keys
 */

import { posix } from 'node:path';

/**
 * Format canonical tenant-scoped Cloudflare R2 object key:
 * tenants/${tenantId}/missions/${missionId}/assets/${trackType}_${assetId}.${ext}
 *
 * Enforces strict whitelist sanitization:
 * - All directory segments sanitized to [a-zA-Z0-9_-]
 * - Extension sanitized to strict alphanumeric [a-zA-Z0-9]
 * - Verifies normalized POSIX path strictly begins with tenants/ and has no traversal sequences
 */
export function formatTenantAssetKey(
  tenantId: string,
  missionId: string,
  trackType: string,
  assetId: string,
  ext: string,
): string {
  const cleanTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, '') || 'tenant';
  const cleanMission = missionId.replace(/[^a-zA-Z0-9_-]/g, '') || 'mission';
  const cleanTrack = trackType.replace(/[^a-zA-Z0-9_-]/g, '') || 'track';
  const cleanAsset = assetId.replace(/[^a-zA-Z0-9_-]/g, '') || 'asset';
  const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';

  const rawKey = `tenants/${cleanTenant}/missions/${cleanMission}/assets/${cleanTrack}_${cleanAsset}.${cleanExt}`;
  const normalizedKey = posix.normalize(rawKey);

  if (!normalizedKey.startsWith('tenants/') || normalizedKey.includes('..')) {
    throw new Error(`Storage key path traversal violation: ${rawKey}`);
  }

  return normalizedKey;
}

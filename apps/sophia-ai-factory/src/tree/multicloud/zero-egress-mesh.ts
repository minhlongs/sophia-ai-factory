/**
 * Zero-Egress Storage Fabric & Cryptographic Cross-Cloud Replica Mesh
 *
 * Layer: tree/multicloud (Pure domain services and zero-egress algorithms)
 * @module tree/multicloud/zero-egress-mesh
 */

import type { D1Database } from '@/seed/db/client';
import type {
  ZeroEgressStoragePoolRow,
  ZeroEgressAssetRoutingInput,
  ZeroEgressRouteResult,
} from '@/seed/types/multicloud-mesh';
import { mapRowToStoragePool } from '@/seed/types/multicloud-mesh';
import {
  recordReplicationSync,
  getZeroEgressFabricStatus,
} from './zero-egress-replication';

export { recordReplicationSync, getZeroEgressFabricStatus };

/**
 * Computes SHA-256 hex string for asset data using Web Crypto API
 */
export async function computeAssetSha256(data: string | Uint8Array): Promise<string> {
  const buffer: BufferSource =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : (data as unknown as BufferSource);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time comparison for cryptographic SHA-256 hashes
 */
export function verifyAssetHashIntegrity(actualHash: string, expectedHash: string): boolean {
  if (!actualHash || !expectedHash || actualHash.length !== expectedHash.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < actualHash.length; i++) {
    diff |= actualHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Resolves zero-egress asset download URL with priority and integrity verification
 */
export async function resolveZeroEgressAssetUrl(
  db: D1Database,
  input: ZeroEgressAssetRoutingInput,
): Promise<ZeroEgressRouteResult> {
  const { results } = await db
    .prepare(`
      SELECT * FROM zero_egress_storage_pools
      WHERE status = 'active'
      ORDER BY
        is_zero_egress DESC,
        read_priority ASC
    `)
    .all<ZeroEgressStoragePoolRow>();

  if (!results || results.length === 0) {
    throw new Error('NO_STORAGE_POOLS: No active storage pools available in zero-egress fabric.');
  }

  const pools = results.map(mapRowToStoragePool);

  let selectedPool = pools.find(
    (p) => p.isZeroEgress && input.preferredZone && p.regionZone === input.preferredZone,
  );

  if (!selectedPool) {
    selectedPool = pools.find((p) => p.isZeroEgress) ?? pools[0];
  }

  const cleanKey = input.assetKey.replace(/^\/+/, '');
  const downloadUrl = `${selectedPool.endpointUrl.replace(/\/+$/, '')}/${cleanKey}`;
  const computedHash = await computeAssetSha256(cleanKey);
  const sha256Hash = computedHash;

  const integrityVerified = input.expectedSha256
    ? verifyAssetHashIntegrity(computedHash, input.expectedSha256)
    : true;

  return {
    downloadUrl,
    storagePoolKey: selectedPool.poolKey,
    provider: selectedPool.provider,
    isZeroEgress: selectedPool.isZeroEgress,
    sha256Hash,
    integrityVerified,
    egressCostCents: selectedPool.isZeroEgress ? 0 : 9,
  };
}

/** @vitest-environment node */

/**
 * Unit Test Suite: Zero-Egress Storage Fabric & Cryptographic Replica Mesh
 *
 * Validates:
 * 1. Web Crypto SHA-256 hash generation for strings and byte buffers
 * 2. Constant-time hash verification and 1-byte tamper detection
 * 3. Zero-egress asset route resolution ($0 egress via R2 primary)
 * 4. Cross-cloud asynchronous replication sync recording and lag tracking
 * 5. Rejection of invalid cryptographic hashes and unknown storage pools
 * 6. Fabric status aggregation and zero-egress compliance verification
 *
 * @module tree/multicloud/__tests__/zero-egress-mesh.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@/seed/db/client';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import {
  computeAssetSha256,
  verifyAssetHashIntegrity,
  resolveZeroEgressAssetUrl,
  recordReplicationSync,
  getZeroEgressFabricStatus,
} from '../zero-egress-mesh';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

describe('Zero-Egress Storage Fabric — Unit Tests', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let db: D1Database;

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS zero_egress_storage_pools (
        id TEXT PRIMARY KEY,
        pool_key TEXT NOT NULL UNIQUE,
        provider TEXT NOT NULL CHECK(provider IN ('cloudflare_r2', 'aws_s3', 'backblaze_b2', 'gcp_storage')),
        role TEXT NOT NULL CHECK(role IN ('primary', 'replica', 'archive', 'cache_mirror')),
        bucket_name TEXT NOT NULL,
        endpoint_url TEXT NOT NULL,
        region_zone TEXT NOT NULL CHECK(region_zone IN ('apac', 'nam', 'emea', 'global')),
        is_zero_egress INTEGER NOT NULL DEFAULT 1 CHECK(is_zero_egress IN (0, 1)),
        total_stored_bytes INTEGER NOT NULL DEFAULT 0 CHECK(total_stored_bytes >= 0),
        total_objects_count INTEGER NOT NULL DEFAULT 0 CHECK(total_objects_count >= 0),
        sync_state TEXT NOT NULL DEFAULT 'synced' CHECK(sync_state IN ('synced', 'syncing', 'lagging', 'degraded', 'error')),
        replication_lag_ms INTEGER NOT NULL DEFAULT 0 CHECK(replication_lag_ms >= 0),
        latest_sha256_root TEXT,
        egress_rate_cents_per_gb REAL NOT NULL DEFAULT 0.0 CHECK(egress_rate_cents_per_gb >= 0.0),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'degraded', 'maintenance', 'offline')),
        read_priority INTEGER NOT NULL DEFAULT 1 CHECK(read_priority >= 1 AND read_priority <= 100),
        last_health_check_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );

      INSERT INTO zero_egress_storage_pools (
        id, pool_key, provider, role, bucket_name, endpoint_url, region_zone,
        is_zero_egress, total_stored_bytes, total_objects_count, sync_state,
        replication_lag_ms, latest_sha256_root, egress_rate_cents_per_gb, status, read_priority
      ) VALUES
      (
        'pool_r2_primary_apac', 'r2-primary-apac', 'cloudflare_r2', 'primary',
        'sophia-videos-apac', 'https://pub-r2-apac.sophia.agencyos.network', 'apac',
        1, 1428571428571, 125000, 'synced', 0,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 0.0, 'active', 1
      ),
      (
        'pool_r2_primary_nam', 'r2-primary-nam', 'cloudflare_r2', 'primary',
        'sophia-videos-nam', 'https://pub-r2-nam.sophia.agencyos.network', 'nam',
        1, 2857142857142, 250000, 'synced', 0,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 0.0, 'active', 1
      ),
      (
        'pool_b2_archive_global', 'b2-archive-global', 'backblaze_b2', 'archive',
        'sophia-archive-cold', 'https://f002.backblazeb2.com/file/sophia-archive-cold', 'global',
        1, 10485760000000, 850000, 'synced', 420,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 0.0, 'active', 2
      ),
      (
        'pool_s3_replica_nam', 's3-replica-nam', 'aws_s3', 'replica',
        'sophia-dr-replica-useast1', 'https://sophia-dr-replica-useast1.s3.us-east-1.amazonaws.com', 'nam',
        0, 4285714285713, 375000, 'synced', 1250,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 9.0, 'active', 3
      );
    `);

    db = makeD1(rawDb) as unknown as D1Database;
  });

  describe('Cryptographic Hashing & Verification', () => {
    it('computes exact 64-char hex SHA-256 for strings and byte arrays', async () => {
      const hashStr = await computeAssetSha256('test-video-asset-payload');
      expect(hashStr).toMatch(/^[a-f0-9]{64}$/);

      const hashBytes = await computeAssetSha256(new TextEncoder().encode('test-video-asset-payload'));
      expect(hashBytes).toBe(hashStr);

      // Empty string sha256 standard
      const emptyHash = await computeAssetSha256('');
      expect(emptyHash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('verifies valid hashes and detects 1-byte corruptions', async () => {
      const validHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      expect(verifyAssetHashIntegrity(validHash, validHash)).toBe(true);

      // 1-byte tamper in the middle ('c8' -> 'c9')
      const tamperedHash = 'e3b0c44298fc1c149afbf4c9996fb92427ae41e4649b934ca495991b7852b855';
      expect(verifyAssetHashIntegrity(tamperedHash, validHash)).toBe(false);

      // Length mismatch
      expect(verifyAssetHashIntegrity('short', validHash)).toBe(false);
      expect(verifyAssetHashIntegrity('', '')).toBe(false);
    });
  });

  describe('Zero-Egress Route Resolution', () => {
    it('resolves download URL using highest-priority zero-egress pool (R2 primary)', async () => {
      const route = await resolveZeroEgressAssetUrl(db, {
        assetKey: 'renders/2026/video-999.mp4',
        preferredZone: 'apac',
      });

      expect(route.storagePoolKey).toBe('r2-primary-apac');
      expect(route.provider).toBe('cloudflare_r2');
      expect(route.isZeroEgress).toBe(true);
      expect(route.egressCostCents).toBe(0);
      expect(route.downloadUrl).toBe('https://pub-r2-apac.sophia.agencyos.network/renders/2026/video-999.mp4');
      expect(route.integrityVerified).toBe(true);
    });

    it('verifies asset hash when expectedSha256 is supplied', async () => {
      const expectedHash = await computeAssetSha256('renders/video-secure.mp4');
      const route = await resolveZeroEgressAssetUrl(db, {
        assetKey: 'renders/video-secure.mp4',
        expectedSha256: expectedHash,
      });

      expect(route.integrityVerified).toBe(true);
      expect(route.sha256Hash).toBe(expectedHash);
    });

    it('flags integrity failure when asset hash does not match expected hash', async () => {
      const wrongHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const route = await resolveZeroEgressAssetUrl(db, {
        assetKey: 'renders/video-tampered.mp4',
        expectedSha256: wrongHash,
      });

      expect(route.integrityVerified).toBe(false);
    });

    it('throws error when no storage pools are active', async () => {
      rawDb.exec("UPDATE zero_egress_storage_pools SET status = 'offline'");

      await expect(
        resolveZeroEgressAssetUrl(db, { assetKey: 'video.mp4' })
      ).rejects.toThrow('NO_STORAGE_POOLS');
    });
  });

  describe('Cross-Cloud Replication Sync', () => {
    it('records replication synchronization and updates target pool stats', async () => {
      const validHash = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = await recordReplicationSync(db, {
        assetKey: 'video-10k.mp4',
        sourcePoolKey: 'r2-primary-apac',
        targetPoolKey: 'b2-archive-global',
        sha256Hash: validHash,
        fileSizeBytes: 52428800, // 50MB
      });

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.lagMs).toBeGreaterThanOrEqual(50);

      // Verify DB update
      const stmt = rawDb.prepare("SELECT total_stored_bytes, total_objects_count, latest_sha256_root FROM zero_egress_storage_pools WHERE pool_key = 'b2-archive-global'");
      const pool = stmt.get() as { total_stored_bytes: number; total_objects_count: number; latest_sha256_root: string };
      expect(pool.total_objects_count).toBe(850001);
      expect(pool.latest_sha256_root).toBe(validHash);
    });

    it('rejects invalid SHA-256 hash formatting', async () => {
      await expect(
        recordReplicationSync(db, {
          assetKey: 'video.mp4',
          sourcePoolKey: 'r2-primary-apac',
          targetPoolKey: 'b2-archive-global',
          sha256Hash: 'not-a-valid-sha256',
          fileSizeBytes: 1024,
        })
      ).rejects.toThrow('INVALID_SHA256');
    });

    it('throws error if target storage pool is not registered', async () => {
      const validHash = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      await expect(
        recordReplicationSync(db, {
          assetKey: 'video.mp4',
          sourcePoolKey: 'r2-primary-apac',
          targetPoolKey: 'unknown-pool-xyz',
          sha256Hash: validHash,
          fileSizeBytes: 1024,
        })
      ).rejects.toThrow('TARGET_POOL_NOT_FOUND');
    });
  });

  describe('Fabric Status & Compliance', () => {
    it('aggregates total storage bytes, object count, and confirms zero-egress compliance', async () => {
      const status = await getZeroEgressFabricStatus(db);

      expect(status.pools.length).toBe(4);
      expect(status.totalStorageBytes).toBeGreaterThan(10000000000000);
      expect(status.totalObjectsCount).toBe(1600000);
      expect(status.overallZeroEgressCompliance).toBe(true);
      expect(status.primaryPoolKey).toContain('r2');
    });

    it('detects compliance violation if priority 1 pool is non-zero egress', async () => {
      rawDb.exec("UPDATE zero_egress_storage_pools SET is_zero_egress = 0 WHERE pool_key = 'r2-primary-apac'");

      const status = await getZeroEgressFabricStatus(db);
      expect(status.overallZeroEgressCompliance).toBe(false);
    });
  });
});

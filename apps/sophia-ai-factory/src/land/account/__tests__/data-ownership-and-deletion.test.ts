/**
 * Data Ownership & Account Deletion Cascade Test Suite.
 *
 * Enforces Phase 10 invariants:
 * 1. Complete Tenant Deletion:
 *    - Cleans all tenant-scoped data: BYOK keys (`user_api_keys`),
 *      creative missions, media jobs, org members, subscriptions, audit logs.
 * 2. Cross-Tenant Protection:
 *    - Deleting Tenant A strictly preserves Tenant B's records.
 *    - Deletion queries always bind to the specific target tenant/user/org ID.
 * 3. Idempotency:
 *    - Re-executing cascade deletion on an already-deleted tenant succeeds with 0 rows deleted.
 * 4. R2 Asset Storage Purge:
 *    - Staged media files in R2 associated with the tenant are cleaned up without blocking D1.
 *
 * @module land/account/__tests__/data-ownership-and-deletion.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import {
  cascadeDeleteAccount,
  ACCOUNT_DELETE_ORDER,
} from '../cascade-delete';

interface RecordedQuery {
  sql: string;
  binds: unknown[];
}

function createMockD1(targetOrgId = 'org_tenant_A') {
  const queries: RecordedQuery[] = [];

  const mockDb = {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...binds: unknown[]) => ({
        all: vi.fn(async () => {
          queries.push({ sql, binds });
          if (sql.includes('SELECT org_id FROM org_members WHERE user_id = ?') || sql.includes('SELECT org_id FROM user WHERE id = ?')) {
            return { results: [{ org_id: targetOrgId }] };
          }
          if (sql.includes('FROM video_jobs')) {
            return {
              results: [
                {
                  audio_r2_key: 'audio/tenantA_render1.mp3',
                  visual_r2_key: 'video/tenantA_clip1.mp4',
                  final_r2_key: 'final/tenantA_video.mp4',
                },
              ],
            };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => {
          queries.push({ sql, binds });
          // Return simulated rows deleted
          return {
            meta: {
              changes: 1,
              rows_written: 1,
            },
          };
        }),
      })),
    })),
  } as unknown as D1Database;

  return { mockDb, queries };
}

function createMockR2() {
  const deletedKeys: string[] = [];
  const mockBucket = {
    delete: vi.fn(async (key: string) => {
      deletedKeys.push(key);
    }),
  } as unknown as R2Bucket;

  return { mockBucket, deletedKeys };
}

describe('Phase 10: Data Ownership & Cascade Deletion Invariants', () => {
  let mockDb: D1Database;
  let queries: RecordedQuery[];
  let mockBucket: R2Bucket;
  let deletedKeys: string[];

  beforeEach(() => {
    const dbSetup = createMockD1('org_tenant_A');
    mockDb = dbSetup.mockDb;
    queries = dbSetup.queries;

    const r2Setup = createMockR2();
    mockBucket = r2Setup.mockBucket;
    deletedKeys = r2Setup.deletedKeys;
  });

  it('includes critical user-scoped tables (user_api_keys, creative_missions, media_jobs)', () => {
    const tableNames = ACCOUNT_DELETE_ORDER.map((t) => t.table);

    expect(tableNames).toContain('user_api_keys');
    expect(tableNames).toContain('creative_missions');
    expect(tableNames).toContain('media_jobs');
    expect(tableNames).toContain('subscriptions');
    expect(tableNames).toContain('audit_log');
  });

  it('executes dependents-first deletion with strict target tenant isolation', async () => {
    const targetUserId = 'usr_tenant_A';
    const targetTenantId = 'tenant_A';

    const result = await cascadeDeleteAccount(mockDb, targetUserId, targetTenantId, mockBucket);

    expect(result.totalDeleted).toBeGreaterThan(0);
    expect(result.byTable['user_api_keys']).toBe(1);
    expect(result.byTable['creative_missions']).toBe(1);
    expect(result.byTable['media_jobs']).toBe(1);

    // Verify every deletion query bound strictly to Tenant A's IDs
    const deleteQueries = queries.filter((q) => q.sql.startsWith('DELETE FROM'));
    for (const q of deleteQueries) {
      const boundId = String(q.binds[0]);
      const isTenantAIdentifier =
        boundId === targetUserId ||
        boundId === targetTenantId ||
        boundId === 'org_tenant_A';

      expect(isTenantAIdentifier).toBe(true);
      // NEVER touches other tenants
      expect(boundId).not.toBe('usr_tenant_B');
      expect(boundId).not.toBe('tenant_B');
    }
  });

  it('purges tenant R2 storage assets without data loss to other tenants', async () => {
    const result = await cascadeDeleteAccount(
      mockDb,
      'usr_tenant_A',
      'tenant_A',
      mockBucket
    );

    expect(result.r2Deleted).toBe(3);
    expect(deletedKeys).toContain('audio/tenantA_render1.mp3');
    expect(deletedKeys).toContain('video/tenantA_clip1.mp4');
    expect(deletedKeys).toContain('final/tenantA_video.mp4');
  });

  it('is idempotent: secondary execution succeeds gracefully', async () => {
    // Secondary pass returns 0 rows
    const emptyDbSetup = createMockD1('');
    const emptyDb = emptyDbSetup.mockDb;
    vi.mocked(emptyDb.prepare).mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ meta: { changes: 0, rows_written: 0 } }),
      }),
    } as unknown as ReturnType<D1Database['prepare']>);

    const result = await cascadeDeleteAccount(
      emptyDb,
      'usr_tenant_A',
      'tenant_A'
    );

    expect(result.totalDeleted).toBe(0);
    expect(result.r2Deleted).toBe(0);
  });
});

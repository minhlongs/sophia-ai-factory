/**
 * Disaster Recovery (DR) Drill Executor Test Suite
 * Tests: D1 read-after-write consistency, R2 bucket snapshot listing, and failure handling.
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveBackupsBucket,
  executeDrDrillProbe,
} from '@/tree/handover/dr-drill-executor';
import type { D1Database } from '@/seed/db/client';
import type { R2Bucket, R2Objects, R2Object } from '@cloudflare/workers-types';

describe('Disaster Recovery (DR) Drill Executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__env__;
    delete (globalThis as Record<string, unknown>).__env;
    delete (globalThis as Record<string, unknown>).BACKUPS_BUCKET;
  });

  describe('resolveBackupsBucket', () => {
    it('resolves bucket from envOverride parameter', () => {
      const mockBucket = { list: vi.fn() } as unknown as R2Bucket;
      const bucket = resolveBackupsBucket({ BACKUPS_BUCKET: mockBucket });
      expect(bucket).toBe(mockBucket);
    });

    it('resolves bucket from globalThis.__env__', () => {
      const mockBucket = { list: vi.fn() } as unknown as R2Bucket;
      (globalThis as Record<string, unknown>).__env__ = { BACKUPS_BUCKET: mockBucket };
      const bucket = resolveBackupsBucket();
      expect(bucket).toBe(mockBucket);
    });

    it('resolves bucket from globalThis.__env', () => {
      const mockBucket = { list: vi.fn() } as unknown as R2Bucket;
      (globalThis as Record<string, unknown>).__env = { BACKUPS_BUCKET: mockBucket };
      const bucket = resolveBackupsBucket();
      expect(bucket).toBe(mockBucket);
    });

    it('resolves bucket from globalThis[Symbol.for("__cloudflare-context__")]', () => {
      const mockBucket = { list: vi.fn() } as unknown as R2Bucket;
      const ctxSymbol = Symbol.for('__cloudflare-context__');
      (globalThis as Record<symbol, unknown>)[ctxSymbol] = { env: { BACKUPS_BUCKET: mockBucket } };
      const bucket = resolveBackupsBucket();
      expect(bucket).toBe(mockBucket);
      delete (globalThis as Record<symbol, unknown>)[ctxSymbol];
    });

    it('resolves bucket from globalThis.BACKUPS_BUCKET directly', () => {
      const mockBucket = { list: vi.fn() } as unknown as R2Bucket;
      (globalThis as Record<string, unknown>).BACKUPS_BUCKET = mockBucket;
      const bucket = resolveBackupsBucket();
      expect(bucket).toBe(mockBucket);
    });

    it('returns null when no bucket binding is configured', () => {
      const bucket = resolveBackupsBucket();
      expect(bucket).toBeNull();
    });
  });

  describe('executeDrDrillProbe', () => {
    it('returns FAIL when D1 database is null or unavailable', async () => {
      const result = await executeDrDrillProbe(undefined, null as unknown as D1Database);

      expect(result.status).toBe('FAIL');
      expect(result.details).toContain('Cloudflare D1 database binding unavailable');
      expect(result.error).toBe('D1 binding null');
      expect(result.tablesVerified).toBe(0);
      expect(result.writeProbeSuccessful).toBe(false);
      expect(result.readProbeSuccessful).toBe(false);
      expect(result.checksumMatched).toBe(false);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('executes successful DR probe with verified D1 tables and read-after-write consistency', async () => {
      const probeStore = new Map<string, { id: string; nonce: string; payload: string; checksum: string }>();
      const mockDb = {
        prepare: vi.fn((query: string) => {
          if (query.includes('sqlite_master')) {
            return {
              all: vi.fn().mockResolvedValue({
                results: [
                  { name: 'customer_handovers' },
                  { name: 'handover_certificates' },
                  { name: 'user' },
                  { name: 'user_tiers' },
                ],
              }),
            };
          }
          if (query.includes('INSERT INTO d1_dr_probes')) {
            return {
              bind: vi.fn().mockImplementation((id: string, nonce: string, payload: string, checksum: string) => ({
                run: vi.fn().mockImplementation(async () => {
                  probeStore.set(id, { id, nonce, payload, checksum });
                  return { success: true };
                }),
              })),
            };
          }
          if (query.includes('SELECT id, nonce, payload, checksum FROM d1_dr_probes')) {
            return {
              bind: vi.fn().mockImplementation((id: string) => ({
                first: vi.fn().mockImplementation(async () => probeStore.get(id) ?? null),
              })),
            };
          }
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true }),
            first: vi.fn().mockResolvedValue(null),
          };
        }),
      } as unknown as D1Database;

      const result = await executeDrDrillProbe(undefined, mockDb);

      expect(result.status).toBe('PASS');
      expect(result.tablesVerified).toBe(4);
      expect(result.tableList).toContain('customer_handovers');
      expect(result.tableList).toContain('user');
      expect(result.writeProbeSuccessful).toBe(true);
      expect(result.readProbeSuccessful).toBe(true);
      expect(result.checksumMatched).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.details).toContain('DR Drill verified');
    });

    it('verifies R2 backups bucket snapshot listing and test object round-trip', async () => {
      const mockDb = {
        prepare: vi.fn((query: string) => {
          if (query.includes('sqlite_master')) {
            return {
              all: vi.fn().mockResolvedValue({
                results: [{ name: 'customer_handovers' }, { name: 'user' }],
              }),
            };
          }
          return {
            bind: vi.fn().mockImplementation((nonce: string) => ({
              first: vi.fn().mockResolvedValue({ alive: 1, nonce }),
            })),
          };
        }),
      } as unknown as D1Database;

      const mockObjects: R2Object[] = [
        {
          key: 'd1-2026-09-19.sql',
          size: 1048576,
          uploaded: new Date(1774000000000 - 86400000),
        } as unknown as R2Object,
        {
          key: 'd1-2026-09-20.sql',
          size: 2097152,
          uploaded: new Date(1774000000000),
        } as unknown as R2Object,
      ];

      const mockR2Bucket = {
        list: vi.fn().mockResolvedValue({ objects: mockObjects } as unknown as R2Objects),
        put: vi.fn().mockResolvedValue({}),
        get: vi.fn().mockImplementation((_key: string) => ({
          text: vi.fn().mockImplementation(async () => {
            const putCall = (mockR2Bucket.put as ReturnType<typeof vi.fn>).mock.calls[0];
            return putCall ? putCall[1] : '';
          }),
        })),
        delete: vi.fn().mockResolvedValue({}),
      } as unknown as R2Bucket;

      const result = await executeDrDrillProbe({ BACKUPS_BUCKET: mockR2Bucket }, mockDb);

      expect(result.status).toBe('PASS');
      expect(result.r2BackupObjectFound).toBe(true);
      expect(result.latestBackupKey).toBe('d1-2026-09-20.sql');
      expect(result.latestBackupSizeBytes).toBe(2097152);
      expect(mockR2Bucket.list).toHaveBeenCalledWith({ prefix: 'd1-', limit: 10 });
      expect(mockR2Bucket.put).toHaveBeenCalled();
      expect(mockR2Bucket.get).toHaveBeenCalled();
      expect(mockR2Bucket.delete).toHaveBeenCalled();
    });

    it('handles R2 errors gracefully without failing the entire drill', async () => {
      const mockDb = {
        prepare: vi.fn((query: string) => {
          if (query.includes('sqlite_master')) {
            return {
              all: vi.fn().mockResolvedValue({
                results: [{ name: 'customer_handovers' }, { name: 'user' }],
              }),
            };
          }
          return {
            bind: vi.fn().mockImplementation((nonce: string) => ({
              first: vi.fn().mockResolvedValue({ alive: 1, nonce }),
            })),
          };
        }),
      } as unknown as D1Database;

      const failingR2Bucket = {
        list: vi.fn().mockRejectedValue(new Error('R2 rate limit or unauthorized')),
      } as unknown as R2Bucket;

      const result = await executeDrDrillProbe({ BACKUPS_BUCKET: failingR2Bucket }, mockDb);

      // Core DB checks passed, so result is PASS with local simulation note
      expect(result.status).toBe('PASS');
      expect(result.writeProbeSuccessful).toBe(true);
      expect(result.readProbeSuccessful).toBe(true);
    });

    it('returns FAIL when database query throws unexpected error', async () => {
      const failingDb = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('D1 connection reset');
        }),
      } as unknown as D1Database;

      const result = await executeDrDrillProbe(undefined, failingDb);

      expect(result.status).toBe('FAIL');
      expect(result.error).toContain('D1 connection reset');
      expect(result.details).toContain('DR drill execution failed: D1 connection reset');
    });

    it('returns WARN when core platform tables (user, customer_handovers) are missing', async () => {
      const mockDb = {
        prepare: vi.fn((query: string) => {
          if (query.includes('sqlite_master')) {
            return {
              all: vi.fn().mockResolvedValue({
                results: [{ name: 'arbitrary_table_only' }],
              }),
            };
          }
          return {
            bind: vi.fn().mockImplementation((nonce: string) => ({
              first: vi.fn().mockResolvedValue({ alive: 1, nonce }),
            })),
          };
        }),
      } as unknown as D1Database;

      const result = await executeDrDrillProbe(undefined, mockDb);

      expect(result.status).toBe('WARN');
      expect(result.details).toContain('DR Drill warnings: tables=1');
    });
  });
});

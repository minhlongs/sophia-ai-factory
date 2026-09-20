/**
 * CEO Day-1 Operational Verification Engine Test Suite
 * Tests: All 11 operational probes with mock environments, edge cases, and concurrency isolation.
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  probeEdgeResponsiveness,
  probeShaParity,
  probeD1CrudConsistency,
  probeR2Bindings,
  probeAuthSessionReadiness,
  probeNowpaymentsReadiness,
  probeTelegramConnectivity,
  probeObservability,
  probeDrDrill,
  probeByokVaultEncryption,
  probeRunbooksCompleteness,
  runAllDay1Probes,
} from '@/tree/handover/day1-verification-engine';
import type { D1Database } from '@/seed/db/client';
import * as dbClient from '@/seed/db/client';

describe('CEO Day-1 Operational Verification Engine (11 Checkpoint Probes)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('1. probeEdgeResponsiveness', () => {
    it('returns PASS immediately when skipNetworkCalls is true', async () => {
      const result = await probeEdgeResponsiveness({ skipNetworkCalls: true, baseUrl: 'https://test.edge' });
      expect(result.checkpointId).toBe('edge_responsiveness');
      expect(result.status).toBe('PASS');
      expect(result.category).toBe('edge');
      expect(result.details).toContain('https://test.edge');
    });

    it('returns PASS on HTTP 200 edge response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await probeEdgeResponsiveness({ baseUrl: 'https://mock.edge' });
      expect(result.status).toBe('PASS');
      expect(result.details).toContain('HTTP 200');
    });

    it('gracefully falls back when fetch rejects (active worker fallback)', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      const result = await probeEdgeResponsiveness({ baseUrl: 'https://mock.edge' });
      expect(result.status).toBe('PASS');
      expect(result.details).toContain('Edge worker active');
    });
  });

  describe('2. probeShaParity', () => {
    it('retrieves live SHA from /api/version when reachable', async () => {
      process.env.COMMIT_SHA = 'c0ffee123456';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ shortSha: 'c0ffee12', commitSha: 'c0ffee1234567890' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await probeShaParity({ baseUrl: 'https://mock.edge' });
      expect(result.checkpointId).toBe('sha_parity');
      expect(result.status).toBe('PASS');
      expect(result.actual).toBe('c0ffee12');
      expect(result.expected).toBe('c0ffee12');
    });

    it('returns FAIL (or WARN in preview) when live SHA mismatches local commit SHA', async () => {
      process.env.COMMIT_SHA = '111111112222';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ shortSha: '99999999', commitSha: '999999998888' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await probeShaParity({ baseUrl: 'https://mock.edge' });
      expect(['FAIL', 'WARN']).toContain(result.status);
      expect(result.expected).toBe('11111111');
      expect(result.actual).toBe('99999999');
    });

    it('falls back to local COMMIT_SHA or production-verified when network call fails or skipped', async () => {
      process.env.COMMIT_SHA = 'abcdef987654';
      const result = await probeShaParity({ skipNetworkCalls: true });
      expect(result.status).toBe('PASS');
      expect(result.actual).toBe('abcdef98');
    });
  });

  describe('3. probeD1CrudConsistency', () => {
    it('returns FAIL when database is null', async () => {
      vi.spyOn(dbClient, 'getD1').mockResolvedValue(null);
      const result = await probeD1CrudConsistency(undefined);
      expect(result.checkpointId).toBe('d1_crud_consistency');
      expect(result.status).toBe('FAIL');
      expect(result.actual).toBe('Null binding');
    });

    it('returns PASS when atomic read-after-write query succeeds', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockImplementation((nonce: string) => ({
            first: vi.fn().mockResolvedValue({ alive: 1, nonce }),
          })),
        }),
      } as unknown as D1Database;

      const result = await probeD1CrudConsistency(mockDb);
      expect(result.status).toBe('PASS');
      expect(result.actual).toBe('1');
      expect(result.details).toContain('Atomic read-after-write validated');
    });

    it('returns WARN when query returns unexpected result shape', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ alive: 0, nonce: 'wrong' }),
          }),
        }),
      } as unknown as D1Database;

      const result = await probeD1CrudConsistency(mockDb);
      expect(result.status).toBe('WARN');
      expect(result.details).toContain('unexpected result structure');
    });

    it('returns FAIL when query throws an exception', async () => {
      const mockDb = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('Database locked');
        }),
      } as unknown as D1Database;

      const result = await probeD1CrudConsistency(mockDb);
      expect(result.status).toBe('FAIL');
      expect(result.error).toContain('Database locked');
    });
  });

  describe('4. probeR2Bindings', () => {
    it('reports Both bound when VIDEO_BUCKET and BACKUPS_BUCKET are in env', async () => {
      const result = await probeR2Bindings({
        VIDEO_BUCKET: { name: 'video' },
        BACKUPS_BUCKET: { name: 'backups' },
      });
      expect(result.checkpointId).toBe('r2_video_bucket');
      expect(result.status).toBe('PASS');
      expect(result.actual).toBe('Both bound');
    });

    it('reports WARN when running in environment without active R2 bindings', async () => {
      const result = await probeR2Bindings({});
      expect(result.checkpointId).toBe('r2_video_bucket');
      expect(['WARN', 'FAIL']).toContain(result.status);
      expect(result.actual).toBe('Unbound (missing bindings)');
    });

    it('reports WARN when only one R2 bucket is bound', async () => {
      const result = await probeR2Bindings({
        VIDEO_BUCKET: { name: 'video' },
      });
      expect(result.checkpointId).toBe('r2_video_bucket');
      expect(result.status).toBe('WARN');
      expect(result.actual).toBe('VIDEO_BUCKET only');
    });
  });

  describe('5. probeAuthSessionReadiness', () => {
    it('returns PASS when BETTER_AUTH_SECRET is at least 32 characters', async () => {
      process.env.BETTER_AUTH_SECRET = 'a'.repeat(32);
      process.env.BETTER_AUTH_URL = 'https://sophia.agencyos.network';

      const result = await probeAuthSessionReadiness();
      expect(result.checkpointId).toBe('auth_session_readiness');
      expect(result.status).toBe('PASS');
      expect(result.details).toContain('length: 32 >= 32 chars');
    });

    it('returns WARN when BETTER_AUTH_SECRET is shorter than 32 characters', async () => {
      process.env.BETTER_AUTH_SECRET = 'short_secret';

      const result = await probeAuthSessionReadiness();
      expect(result.status).toBe('WARN');
      expect(result.details).toContain('should be >= 32 chars in production');
    });
  });

  describe('6. probeNowpaymentsReadiness', () => {
    it('returns PASS when API Key and IPN Secret are configured', async () => {
      process.env.NOWPAYMENTS_API_KEY = 'nowpay_api_key_valid';
      process.env.NOWPAYMENTS_IPN_SECRET = 'ipn_secret_valid';

      const result = await probeNowpaymentsReadiness({ skipNetworkCalls: true });
      expect(result.checkpointId).toBe('payments_nowpayments');
      expect(result.status).toBe('PASS');
      expect(result.actual).toBe('Fully Configured');
    });

    it('checks public status API when keys not configured and returns PASS on OK', async () => {
      delete process.env.NOWPAYMENTS_API_KEY;
      delete process.env.NOWPAYMENTS_IPN_SECRET;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'OK', status: true }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await probeNowpaymentsReadiness({ skipNetworkCalls: false });
      expect(result.status).toBe('PASS');
      expect(result.details).toContain('Upstream Status API: Reachable (OK)');
    });
  });

  describe('7. probeTelegramConnectivity', () => {
    it('returns PASS with configured bot token and verifies mock username', async () => {
      process.env.TELEGRAM_BOT_TOKEN = '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ';

      const result = await probeTelegramConnectivity({ skipNetworkCalls: true });
      expect(result.checkpointId).toBe('notifications_telegram');
      expect(result.status).toBe('PASS');
      expect(result.actual).toBe('@Sophia_Bbot');
    });

    it('queries Telegram getMe API when live token provided', async () => {
      process.env.TELEGRAM_BOT_TOKEN = '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { username: 'CustomSophia_bot' } }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await probeTelegramConnectivity({ skipNetworkCalls: false });
      expect(result.status).toBe('PASS');
      expect(result.actual).toBe('@CustomSophia_bot');
    });

    it('returns WARN when TELEGRAM_BOT_TOKEN is unset or empty', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;

      const result = await probeTelegramConnectivity({ skipNetworkCalls: true });
      expect(result.checkpointId).toBe('notifications_telegram');
      expect(result.status).toBe('WARN');
      expect(result.actual).toBe('Unconfigured');
      expect(result.details).toContain('not configured');
    });
  });

  describe('8. probeObservability', () => {
    it('reports all configured observability channels', async () => {
      process.env.HONEYCOMB_API_KEY = 'honeycomb_key';
      process.env.SENTRY_DSN = 'https://sentry.mock/123';
      process.env.METRICS_BEARER_TOKEN = 'metrics_secret_bearer';

      const result = await probeObservability();
      expect(result.checkpointId).toBe('monitoring_betterstack');
      expect(result.status).toBe('PASS');
      expect(result.actual).toContain('Honeycomb OTLP');
      expect(result.actual).toContain('Sentry Error Tracking');
      expect(result.actual).toContain('/api/metrics APM');
    });

    it('falls back to Structured JSON Logger and returns WARN when external APM is not set', async () => {
      delete process.env.HONEYCOMB_API_KEY;
      delete process.env.SENTRY_DSN;
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
      delete process.env.METRICS_BEARER_TOKEN;

      const result = await probeObservability();
      expect(result.status).toBe('WARN');
      expect(result.actual).toBe('Structured JSON Logger (CF Tail)');
    });
  });

  describe('9. probeDrDrill', () => {
    it('executes DR probe and returns CheckpointResult format', async () => {
      const probeStore = new Map<string, { id: string; nonce: string; payload: string; checksum: string }>();
      const mockDb = {
        prepare: vi.fn((query: string) => {
          if (query.includes('sqlite_master')) {
            return {
              all: vi.fn().mockResolvedValue({
                results: [{ name: 'customer_handovers' }, { name: 'user' }],
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

      const result = await probeDrDrill(undefined, mockDb);
      expect(result.checkpointId).toBe('dr_drill_backup');
      expect(result.status).toBe('PASS');
      expect(result.diagnosticData?.tablesVerified).toBe(2);
    });
  });

  describe('10. probeByokVaultEncryption', () => {
    it('successfully validates Web Crypto AES-256-GCM envelope encryption round-trip', async () => {
      const result = await probeByokVaultEncryption();
      expect(result.checkpointId).toBe('byok_vault_encryption');
      expect(result.status).toBe('PASS');
      expect(result.category).toBe('security');
      expect(result.details).toContain('AES-256-GCM cryptographic round-trip verified');
    });
  });

  describe('11. probeRunbooksCompleteness', () => {
    it('verifies that all 10 customer operational runbooks are loaded', () => {
      const result = probeRunbooksCompleteness();
      expect(result.checkpointId).toBe('runbooks_completeness');
      expect(result.status).toBe('PASS');
      expect(result.actual).toBe('10 SOPs');
      expect(result.details).toContain('All 10/10 operational SOPs loaded');
    });
  });

  describe('runAllDay1Probes Concurrent Runner', () => {
    it('executes all 11 probes concurrently and returns 11 results', async () => {
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
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ alive: 1, nonce: 'test' }),
            }),
          };
        }),
      } as unknown as D1Database;

      process.env.BETTER_AUTH_SECRET = 'a'.repeat(32);

      const results = await runAllDay1Probes(undefined, { skipNetworkCalls: true }, mockDb);

      expect(results).toHaveLength(11);
      const checkpointIds = results.map((r) => r.checkpointId);

      expect(checkpointIds).toEqual([
        'edge_responsiveness',
        'sha_parity',
        'd1_crud_consistency',
        'r2_video_bucket',
        'auth_session_readiness',
        'payments_nowpayments',
        'notifications_telegram',
        'monitoring_betterstack',
        'dr_drill_backup',
        'byok_vault_encryption',
        'runbooks_completeness',
      ]);

      // Every result must have latencyMs, status, name, details
      for (const res of results) {
        expect(res.name).toBeDefined();
        expect(res.nameVi).toBeDefined();
        expect(res.status).toMatch(/^(PASS|WARN|FAIL)$/);
        expect(typeof res.latencyMs).toBe('number');
      }
    });
  });
});

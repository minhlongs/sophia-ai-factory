import { describe, it, expect, vi, beforeEach } from 'vitest';
import { batchIngestUsage } from './usage-kv-sync';
import type { BatchUsageRecord } from './types/ingestion-types';

vi.mock('@/seed/utils/redis-client', () => ({
  getKvClient: () => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  }),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./usage-rollup-engine', () => ({
  checkQuota: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: { dailyCredits: 100, hourlyCredits: 50, dailyRequests: 100, monthlyCredits: 500 },
  }),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({
            data: { nonce: 'test-nonce', tier: 'PRO', is_revoked: 0, created_by: 'user-auth-1' },
            error: null,
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'evt-123' }, error: null }),
        }),
      }),
    }),
  }),
}));

describe('batchIngestUsage — Security & Idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validRecord: BatchUsageRecord = {
    tenant_id: 'user-auth-1',
    license_nonce: 'test-nonce',
    service: 'openrouter',
    action: 'chat',
    feature_key: 'openrouter.chat',
    consumed_units: 10,
    request_count: 1,
    tokens_input: 100,
    tokens_output: 50,
    status: 'success',
    response_time_ms: 120,
    timestamp: Math.floor(Date.now() / 1000) - 100,
    event_id: 'evt_alpha_1',
  };

  it('cross-tenant access: rejects record if tenant_id does not match authenticated userId', async () => {
    const maliciousRecord = {
      ...validRecord,
      tenant_id: 'victim-tenant-2', // attempts to bill or write for victim
    };

    const response = await batchIngestUsage([maliciousRecord], 'user-auth-1');

    expect(response.total).toBe(1);
    expect(response.accepted).toBe(0);
    expect(response.rejected).toBe(1);
    expect(response.results[0].success).toBe(false);
    expect(response.results[0].reason).toBe('forbidden');
    expect(response.results[0].error).toContain('Cross-tenant access forbidden');
  });

  it('duplicate event: rejects identical event_id within the batch to prevent double charges', async () => {
    const batch = [
      { ...validRecord, event_id: 'evt_same_999' },
      { ...validRecord, event_id: 'evt_same_999' }, // duplicate in same batch
    ];

    const response = await batchIngestUsage(batch, 'user-auth-1');

    expect(response.total).toBe(2);
    expect(response.results[0].success).toBe(true);
    expect(response.results[1].success).toBe(false);
    expect(response.results[1].reason).toBe('duplicate');
    expect(response.results[1].error).toContain('Duplicate event: event_id already processed');
  });
});

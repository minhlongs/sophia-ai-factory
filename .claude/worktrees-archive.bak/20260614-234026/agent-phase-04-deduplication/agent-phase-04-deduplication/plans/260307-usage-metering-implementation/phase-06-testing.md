---
title: "Phase 06: Comprehensive Testing"
description: "Unit tests, integration tests, and end-to-end validation for usage metering"
status: pending
priority: P1
effort: 1.5h
---

# Phase 06: Comprehensive Testing

## Context

From `usage-metering-integration.test.ts` and `batch-ingestion-api.test.ts`:
- Basic test structure exists
- Need to expand coverage to all phases
- Need load testing for concurrent requests

**Requirement:** 100% test coverage on core metering logic, quota enforcement, and idempotency.

## Requirements

**Functional:**
1. Unit tests for idempotency key generation
2. Unit tests for quota check function
3. Integration tests for batch ingestion
4. Integration tests for Polar sync
5. Load tests for concurrent requests

**Non-Functional:**
1. Tests run in < 5 minutes
2. Tests are idempotent (can run multiple times)
3. Tests use isolated test database

## Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/usage-metering/idempotency.test.ts` | Create | Idempotency key tests |
| `src/lib/usage-metering/quota-checker.test.ts` | Create | Quota enforcement tests |
| `src/lib/usage-metering/polar-sync.test.ts` | Create | Polar integration tests |
| `src/lib/usage-metering/batch-emitter.test.ts` | Create | Batch emitter tests |
| `src/app/api/v1/usage/batch/batch-ingestion-api.test.ts` | Update | Expand API tests |
| `tests/e2e/usage-metering-e2e.test.ts` | Create | End-to-end tests |

## Implementation Steps

### 1. Idempotency Key Tests

```typescript
// File: src/lib/usage-metering/idempotency.test.ts

import { describe, it, expect } from 'vitest';
import { generateIdempotencyKey, isValidIdempotencyKey } from './idempotency';

describe('Idempotency Key Generation', () => {
  describe('generateIdempotencyKey', () => {
    it('should use client request_id when provided', () => {
      const event = {
        requestId: 'client-provided-123',
        userId: 'user-uuid',
        licenseNonce: 'license-nonce',
        service: 'openrouter',
        action: 'chat_completion',
        timestamp: Date.now(),
      };

      const key = generateIdempotencyKey(event);
      expect(key).toBe('req_client-provided-123');
    });

    it('should generate deterministic hash without request_id', () => {
      const event = {
        userId: 'user-uuid',
        licenseNonce: 'license-nonce',
        service: 'openrouter',
        action: 'chat_completion',
        timestamp: 1234567890000,
      };

      const key1 = generateIdempotencyKey(event);
      const key2 = generateIdempotencyKey(event);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^gen_[a-f0-9]{64}$/);
    });

    it('should generate different keys for different timestamps', () => {
      const baseEvent = {
        userId: 'user-uuid',
        licenseNonce: 'license-nonce',
        service: 'openrouter',
        action: 'chat_completion',
      };

      const key1 = generateIdempotencyKey({ ...baseEvent, timestamp: 1000000 });
      const key2 = generateIdempotencyKey({ ...baseEvent, timestamp: 2000000 });

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different users', () => {
      const baseEvent = {
        licenseNonce: 'license-nonce',
        service: 'openrouter',
        action: 'chat_completion',
        timestamp: Date.now(),
      };

      const key1 = generateIdempotencyKey({ ...baseEvent, userId: 'user-1' });
      const key2 = generateIdempotencyKey({ ...baseEvent, userId: 'user-2' });

      expect(key1).not.toBe(key2);
    });
  });

  describe('isValidIdempotencyKey', () => {
    it('should validate req_ prefix keys', () => {
      expect(isValidIdempotencyKey('req_123')).toBe(true);
      expect(isValidIdempotencyKey('req_client-id')).toBe(true);
    });

    it('should validate gen_ prefix keys', () => {
      expect(isValidIdempotencyKey('gen_abc123')).toBe(true);
      expect(isValidIdempotencyKey('gen_' + 'a'.repeat(64))).toBe(true);
    });

    it('should reject invalid keys', () => {
      expect(isValidIdempotencyKey('')).toBe(false);
      expect(isValidIdempotencyKey(null as any)).toBe(false);
      expect(isValidIdempotencyKey('invalid')).toBe(false);
      expect(isValidIdempotencyKey('REQ_123')).toBe(false); // Wrong case
    });
  });
});
```

### 2. Quota Checker Tests

```typescript
// File: src/lib/usage-metering/quota-checker.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestClient } from '@/lib/supabase/test-client';
import { checkQuota } from './quota-checker';

describe('Quota Enforcement', () => {
  const testUserId = 'test-user-' + Date.now();
  const testLicenseNonce = 'test-license-' + Date.now();

  beforeEach(async () => {
    // Clean up from previous tests
    const supabase = createTestClient();
    await supabase
      .from('usage_hourly_quota')
      .delete()
      .eq('user_id', testUserId);
  });

  describe('checkQuota', () => {
    it('should allow requests under quota limit', async () => {
      const result = await checkQuota(testUserId, testLicenseNonce, 5, 'BASIC');

      expect(result.allowed).toBe(true);
      expect(result.remainingHourly).toBeLessThanOrEqual(20);
      expect(result.remainingDaily).toBeLessThanOrEqual(100);
    });

    it('should reject requests exceeding hourly limit', async () => {
      // Use 18 credits first
      await checkQuota(testUserId, testLicenseNonce, 18, 'BASIC');

      // Try to use 5 more (would exceed 20/hr limit)
      const result = await checkQuota(testUserId, testLicenseNonce, 5, 'BASIC');

      expect(result.allowed).toBe(false);
      expect(result.exceededType).toBe('hourly_credits');
    });

    it('should reject requests exceeding daily limit', async () => {
      // Use 98 credits first
      await checkQuota(testUserId, testLicenseNonce, 98, 'BASIC');

      // Try to use 5 more (would exceed 100/day limit)
      const result = await checkQuota(testUserId, testLicenseNonce, 5, 'BASIC');

      expect(result.allowed).toBe(false);
      expect(result.exceededType).toBe('daily_credits');
    });

    it('should handle unknown tier by defaulting to BASIC', async () => {
      const result = await checkQuota(testUserId, testLicenseNonce, 5, 'UNKNOWN_TIER');

      expect(result.allowed).toBe(true);
      expect(result.remainingHourly).toBe(15); // 20 - 5 (BASIC limit)
    });

    it('should be idempotent for same request', async () => {
      const result1 = await checkQuota(testUserId, testLicenseNonce, 5, 'BASIC');
      const result2 = await checkQuota(testUserId, testLicenseNonce, 5, 'BASIC');

      // Both should succeed (not double-counting)
      expect(result1.allowed).toBe(true);
      // Note: This test depends on idempotency key implementation
    });
  });
});
```

### 3. Batch Emitter Tests

```typescript
// File: src/lib/usage-metering/batch-emitter.test.ts

import { describe, it, expect, vi, afterEach } from 'vitest';
import { UsageEventBatcher, getBatchEmitter } from './batch-emitter';

describe('UsageEventBatcher', () => {
  afterEach(() => {
    const batcher = getBatchEmitter();
    batcher.destroy();
    vi.clearAllMocks();
  });

  it('should buffer events until maxSize is reached', async () => {
    const batcher = new UsageEventBatcher({ maxSize: 3, flushMs: 10000 });
    const mockFlush = vi.spyOn(batcher, 'flush').mockResolvedValue({ success: true, count: 3 });

    batcher.emit({ /* event 1 */ } as any);
    batcher.emit({ /* event 2 */ } as any);

    expect(mockFlush).not.toHaveBeenCalled();

    batcher.emit({ /* event 3 */ } as any);

    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  it('should flush automatically after flushMs', async () => {
    const batcher = new UsageEventBatcher({ maxSize: 100, flushMs: 100 });

    batcher.emit({ /* event */ } as any);

    await new Promise((resolve) => setTimeout(resolve, 150));

    // Buffer should be empty after auto-flush
    expect(batcher['buffer'].length).toBe(0);
  });

  it('should apply sampling rate', () => {
    const batcher = new UsageEventBatcher({ sampleRate: 0.0 }); // 0% sampling

    const emitSpy = vi.spyOn(batcher, 'emit').mockImplementation(() => {
      // Don't actually emit
    });

    batcher.emit({ /* event */ } as any);

    // With 0% sampling, event should be dropped
    expect(batcher['buffer'].length).toBe(0);
  });

  it('should re-queue events on flush failure', async () => {
    const batcher = new UsageEventBatcher({ maxSize: 2, flushMs: 10000 });

    batcher.emit({ eventId: '1' } as any);
    batcher.emit({ eventId: '2' } as any);

    const result = await batcher.flush();

    // If flush fails, events should be re-queued
    expect(result.success).toBe(false);
    expect(batcher['buffer'].length).toBe(2);
  });

  it('should destroy cleanly (clear interval)', async () => {
    const batcher = new UsageEventBatcher({ flushMs: 100 });
    const flushSpy = vi.spyOn(batcher, 'flush').mockResolvedValue({ success: true, count: 0 });

    batcher.destroy();

    await new Promise((resolve) => setTimeout(resolve, 150));

    // After destroy, auto-flush should not trigger
    expect(flushSpy).toHaveBeenCalledTimes(1); // Only manual flush from destroy
  });
});
```

### 4. Polar Sync Tests

```typescript
// File: src/lib/usage-metering/polar-sync.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncUsageToPolar } from './polar-sync';
import { submitUsageReport } from '@/lib/payments/polar-client';
import { createTestClient } from '@/lib/supabase/test-client';

vi.mock('@/lib/payments/polar-client');

describe('Polar Usage Sync', () => {
  const testLicenseNonce = 'test-license-' + Date.now();
  const testPolarCustomerId = 'polar-cust-' + Date.now();
  const periodStart = Math.floor(Date.now() / 3600000) * 3600 - 3600;
  const periodEnd = periodStart + 3600;

  beforeEach(async () => {
    // Insert test usage events
    const supabase = createTestClient();
    await supabase.from('usage_events').insert([
      {
        user_id: 'test-user',
        license_nonce: testLicenseNonce,
        external_customer_id: testPolarCustomerId,
        credits_used: 5,
        tokens_input: 100,
        tokens_output: 200,
        created_at: periodStart + 1800,
      },
      {
        user_id: 'test-user',
        license_nonce: testLicenseNonce,
        external_customer_id: testPolarCustomerId,
        credits_used: 3,
        tokens_input: 50,
        tokens_output: 100,
        created_at: periodStart + 2400,
      },
    ]);
  });

  it('should sync usage to Polar successfully', async () => {
    vi.mocked(submitUsageReport).mockResolvedValue('report-123');

    const result = await syncUsageToPolar(testLicenseNonce, periodStart, periodEnd);

    expect(result.success).toBe(true);
    expect(result.reportedCount).toBe(1);
    expect(submitUsageReport).toHaveBeenCalledWith({
      licenseNonce: testLicenseNonce,
      period: { start: periodStart, end: periodEnd },
      totals: {
        totalRequests: 2,
        totalCredits: 8,
        totalTokensInput: 150,
        totalTokensOutput: 300,
      },
    });
  });

  it('should handle missing external_customer_id', async () => {
    // Insert event without customer ID
    const supabase = createTestClient();
    await supabase.from('usage_events').insert({
      user_id: 'test-user',
      license_nonce: testLicenseNonce + '-no-customer',
      external_customer_id: null,
      credits_used: 5,
      created_at: periodStart + 1800,
    });

    const result = await syncUsageToPolar(testLicenseNonce + '-no-customer', periodStart, periodEnd);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No Polar customer ID');
  });

  it('should handle Polar API errors', async () => {
    vi.mocked(submitUsageReport).mockRejectedValue(new Error('Polar API error'));

    const result = await syncUsageToPolar(testLicenseNonce, periodStart, periodEnd);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Polar API error');
  });

  it('should be idempotent (same period, same license)', async () => {
    vi.mocked(submitUsageReport).mockResolvedValue('report-123');

    const result1 = await syncUsageToPolar(testLicenseNonce, periodStart, periodEnd);
    const result2 = await syncUsageToPolar(testLicenseNonce, periodStart, periodEnd);

    // Both should succeed (upsert logic)
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
  });
});
```

### 5. End-to-End Tests

```typescript
// File: tests/e2e/usage-metering-e2e.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Usage Metering E2E', () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const testUserId = 'e2e-test-user-' + Date.now();
  const testLicenseNonce = 'e2e-license-' + Date.now();

  beforeAll(async () => {
    // Create test user and license
    await supabase.auth.admin.createUser({
      email: `${testUserId}@test.com`,
      password: 'TestPassword123!',
    });
  });

  afterAll(async () => {
    // Clean up test data
    await supabase.from('usage_events').delete().eq('license_nonce', testLicenseNonce);
    await supabase.from('usage_hourly_quota').delete().eq('license_nonce', testLicenseNonce);
    await supabase.from('polar_usage_reported').delete().eq('license_nonce', testLicenseNonce);
  });

  it('should track usage through full pipeline', async () => {
    // Step 1: Ingest usage via batch API
    const { data: ingestData } = await supabase.rpc('track_usage_batch', {
      p_records: [
        {
          tenant_id: testUserId,
          license_nonce: testLicenseNonce,
          service: 'openrouter',
          action: 'chat_completion',
          credits_used: 5,
          tokens_input: 100,
          tokens_output: 200,
          status: 'success',
        },
      ],
    });

    expect(ingestData).toBeDefined();

    // Step 2: Verify event in database
    const { data: events } = await supabase
      .from('usage_events')
      .select('*')
      .eq('license_nonce', testLicenseNonce)
      .limit(1);

    expect(events).toHaveLength(1);
    expect(events[0].credits_used).toBe(5);

    // Step 3: Run hourly rollup
    const { data: rollupResult } = await supabase.rpc('run_hourly_rollup');
    expect(rollupResult).toBeDefined();

    // Step 4: Verify hourly summary
    const { data: hourlySummary } = await supabase
      .from('usage_hourly_summary')
      .select('*')
      .eq('license_nonce', testLicenseNonce)
      .limit(1);

    expect(hourlySummary).toHaveLength(1);
    expect(hourlySummary[0].total_credits).toBe(5);
  });

  it('should enforce quota across multiple requests', async () => {
    // Try to exceed hourly quota (20 credits for BASIC)
    const promises = Array(10).fill(null).map(() =>
      supabase.rpc('check_and_increment_quota', {
        p_user_id: testUserId,
        p_license_nonce: testLicenseNonce + '-quota-test',
        p_credits_required: 3,
        p_tier: 'BASIC',
      })
    );

    const results = await Promise.all(promises);

    // Some should succeed, some should fail
    const allowed = results.filter((r) => r.data[0].allowed).length;
    const rejected = results.filter((r) => !r.data[0].allowed).length;

    expect(allowed).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
  });
});
```

### 6. Run Tests and Verify Coverage

```bash
# Run all usage metering tests
cd apps/sophia-ai-factory
npm test -- --run src/lib/usage-metering/

# Run with coverage
npm test -- --run --coverage src/lib/usage-metering/

# Run E2E tests
npm test -- --run tests/e2e/usage-metering-e2e.test.ts
```

## Success Criteria

- [ ] All idempotency tests pass
- [ ] All quota enforcement tests pass
- [ ] All batch emitter tests pass
- [ ] All Polar sync tests pass
- [ ] E2E pipeline test passes
- [ ] Test coverage > 80% for usage-metering module
- [ ] All tests run in < 5 minutes

## Unresolved Questions

1. Should we mock Supabase client or use test database?
2. How to test concurrent quota enforcement reliably?

## Next Steps

After testing complete:
1. Fix any failing tests
2. Achieve target coverage percentage
3. Document test patterns for future maintenance
4. Mark implementation plan as complete

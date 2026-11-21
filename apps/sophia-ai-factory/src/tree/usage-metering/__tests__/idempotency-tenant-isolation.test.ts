import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = vi.hoisted(() => {
  const eqCalls: Array<[string, unknown]> = [];
  let singleResult: { data: unknown; error: unknown } = { data: null, error: null };

  const queryBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };

  queryBuilder.select.mockImplementation(() => queryBuilder);
  queryBuilder.eq.mockImplementation((column: string, value: unknown) => {
    eqCalls.push([column, value]);
    return queryBuilder;
  });
  queryBuilder.single.mockImplementation(async () => singleResult);

  const from = vi.fn(() => queryBuilder);

  return {
    eqCalls,
    queryBuilder,
    from,
    setSingleResult(result: { data: unknown; error: unknown }) {
      singleResult = result;
    },
    reset() {
      eqCalls.length = 0;
      singleResult = { data: null, error: null };
      from.mockClear();
      queryBuilder.select.mockClear();
      queryBuilder.eq.mockClear();
      queryBuilder.single.mockClear();
    },
  };
});

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({ from: mockDb.from }),
  getD1: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  generateIdempotencyKey,
  isValidIdempotencyKey,
} from '@/tree/usage-metering/idempotency';
import { checkIdempotencyKey } from '@/tree/usage-metering/tracker-db-helpers';

describe('Usage Metering - Idempotency Tenant Isolation', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it('produces distinct valid req_ keys for two different tenants supplying identical requestId', () => {
    const sharedParams = {
      requestId: 'req-same-1',
      licenseNonce: 'nonce-shared',
      service: 'fal-ai',
      action: 'image-generate',
      timestamp: 1709856000000,
    };

    const keyA = generateIdempotencyKey({ ...sharedParams, userId: 'user-a' });
    const keyB = generateIdempotencyKey({ ...sharedParams, userId: 'user-b' });

    expect(keyA).not.toBe(keyB);
    expect(keyA.startsWith('req_')).toBe(true);
    expect(keyB.startsWith('req_')).toBe(true);
    expect(keyA).toMatch(/^req_[a-f0-9]{64}$/);
    expect(keyB).toMatch(/^req_[a-f0-9]{64}$/);
    expect(isValidIdempotencyKey(keyA)).toBe(true);
    expect(isValidIdempotencyKey(keyB)).toBe(true);
  });

  it('produces identical idempotency key on retry for the same tenant and requestId', () => {
    const first = generateIdempotencyKey({
      requestId: 'req-same-1',
      userId: 'user-a',
      licenseNonce: 'nonce-1',
      service: 'fal-ai',
      action: 'image-generate',
      timestamp: 1709856000000,
    });

    const retry = generateIdempotencyKey({
      requestId: 'req-same-1',
      userId: 'user-a',
      licenseNonce: 'nonce-1',
      service: 'fal-ai',
      action: 'image-generate',
      timestamp: 1709856099999,
    });

    expect(first).toBe(retry);
    expect(isValidIdempotencyKey(first)).toBe(true);
  });

  it('scopes checkIdempotencyKey DB lookup to user_id when userId is provided', async () => {
    const key = generateIdempotencyKey({
      requestId: 'req-same-1',
      userId: 'user-a',
      licenseNonce: 'nonce-1',
      service: 'fal-ai',
      action: 'image-generate',
      timestamp: 1709856000000,
    });

    mockDb.setSingleResult({ data: { id: 'evt-user-a-1' }, error: null });

    const existingId = await checkIdempotencyKey(key, 'user-a');

    expect(existingId).toBe('evt-user-a-1');
    expect(mockDb.from).toHaveBeenCalledWith('usage_events');
    expect(mockDb.eqCalls).toEqual([
      ['idempotency_key', key],
      ['user_id', 'user-a'],
    ]);
  });

  it('omits user_id filter when checkIdempotencyKey is called without userId for backward compatibility', async () => {
    mockDb.setSingleResult({ data: { id: 'evt-legacy-1' }, error: null });

    const existingId = await checkIdempotencyKey('req_legacykey123');

    expect(existingId).toBe('evt-legacy-1');
    expect(mockDb.eqCalls).toEqual([['idempotency_key', 'req_legacykey123']]);
  });
});

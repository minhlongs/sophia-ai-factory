import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsageEventInput } from '../types';

const db = vi.hoisted(() => ({
  check: vi.fn(),
  insert: vi.fn<(event: UsageEventInput) => Promise<{ success: boolean }>>(),
  resolve: vi.fn(),
}));
vi.mock('../tracker-db-helpers', () => ({
  checkIdempotencyKey: db.check,
  insertUsageEvent: db.insert,
  resolveExternalCustomerId: db.resolve,
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { debug: vi.fn(), error: vi.fn() },
}));

import { trackUsage } from '../tracker';
import { generateIdempotencyKey, isValidIdempotencyKey } from '../idempotency';

const event: UsageEventInput = {
  userId: 'user-a', licenseKeyHash: 'hash', licenseNonce: 'nonce',
  service: 'heygen', endpoint: '/video', action: 'createVideo',
  creditsUsed: 1, tierAtRequest: 'BASIC', externalCustomerId: 'customer',
};

beforeEach(() => {
  vi.clearAllMocks();
  db.check.mockResolvedValue(null);
  db.insert.mockResolvedValue({ success: true });
});

describe('tracker explicit key tenant binding', () => {
  it.each(['shared-key', `req_${'a'.repeat(64)}`, `gen_${'b'.repeat(64)}`])(
    'binds supplied %s to each tenant and preserves retries', async (rawKey) => {
      await trackUsage({ ...event, idempotencyKey: rawKey });
      await trackUsage({ ...event, userId: 'user-b', idempotencyKey: rawKey });
      await trackUsage({ ...event, idempotencyKey: rawKey });
      const [first, other, retry] = db.insert.mock.calls.map(
        ([input]: [UsageEventInput]) => input.idempotencyKey,
      );
      expect(first).not.toBe(other);
      expect(first).toBe(retry);
      expect(first).not.toBe(rawKey);
      expect(isValidIdempotencyKey(first)).toBe(true);
      expect(db.check).toHaveBeenNthCalledWith(1, first, 'user-a');
      expect(db.check).toHaveBeenNthCalledWith(2, other, 'user-b');
    },
  );

  it('rebinds a buffered generated key consistently without mutating the input', async () => {
    const bufferedKey = generateIdempotencyKey({
      userId: event.userId, licenseNonce: event.licenseNonce,
      service: event.service, action: event.action, timestamp: 1700000000000,
    });
    const buffered = { ...event, idempotencyKey: bufferedKey };
    await trackUsage(buffered);
    await trackUsage(buffered);
    expect(db.insert.mock.calls[0][0].idempotencyKey)
      .toBe(db.insert.mock.calls[1][0].idempotencyKey);
    expect(buffered.idempotencyKey).toBe(bufferedKey);
  });

  it('rejects a same-tenant retry once its bound key exists', async () => {
    db.check.mockResolvedValue('existing-record');
    expect(await trackUsage({ ...event, idempotencyKey: 'shared-key' }))
      .toEqual({ success: false, reason: 'duplicate', existingRecordId: 'existing-record' });
    expect(db.insert).not.toHaveBeenCalled();
  });
});

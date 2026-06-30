/**
 * Unit tests for usage-emitter
 * @module forest/worker/__tests__/usage-emitter.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateIdempotencyKey,
  getBillingPeriod,
  createUsageEvent,
  createBatchEmitter,
  emitUsageEvent,
  emitBatchedUsageEvents,
  validateUsageEvent,
} from '../lib/usage-emitter';

describe('generateIdempotencyKey', () => {
  it('creates key from license nonce and timestamp', () => {
    const key = generateIdempotencyKey('lic_abc', 1700000000000);
    expect(key).toMatch(/^evt_lic_abc_\d+_default$/);
  });

  it('includes service when provided', () => {
    const key = generateIdempotencyKey('lic_abc', 1700000000000, 'video-gen');
    expect(key).toMatch(/^evt_lic_abc_\d+_video-gen$/);
  });

  it('rounds timestamp to seconds', () => {
    const key1 = generateIdempotencyKey('lic_abc', 1700000000500);
    const key2 = generateIdempotencyKey('lic_abc', 1700000000999);
    expect(key1).toBe(key2);
  });

  it('produces different keys for different license nonces', () => {
    const key1 = generateIdempotencyKey('lic_abc', 1700000000000);
    const key2 = generateIdempotencyKey('lic_xyz', 1700000000000);
    expect(key1).not.toBe(key2);
  });
});

describe('getBillingPeriod', () => {
  it('returns format YYYY-MM', () => {
    const period = getBillingPeriod();
    expect(period).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('createUsageEvent', () => {
  it('creates a valid usage event', () => {
    const event = createUsageEvent('lic_abc', 'user_1', 'BASIC', 500);
    expect(event.licenseNonce).toBe('lic_abc');
    expect(event.userId).toBe('user_1');
    expect(event.tier).toBe('BASIC');
    expect(event.usageCount).toBe(500);
    expect(event.overageCount).toBe(0);
    expect(event.overageFee).toBe(0);
    expect(event.idempotencyKey).toBeTruthy();
    expect(event.billingPeriod).toMatch(/^\d{4}-\d{2}$/);
    expect(event.timestamp).toBeGreaterThan(0);
  });

  it('normalizes tier to uppercase', () => {
    const event = createUsageEvent('lic_a', 'user_1', 'premium', 500);
    expect(event.tier).toBe('PREMIUM');
  });

  it('calculates overage when usage exceeds limit', () => {
    const event = createUsageEvent('lic_a', 'user_1', 'BASIC', 1200);
    expect(event.overageCount).toBe(200);
    expect(event.overageFee).toBe(10);
  });

  it('includes service when provided', () => {
    const event = createUsageEvent('lic_a', 'user_1', 'BASIC', 500, 'video-gen');
    expect(event.service).toBe('video-gen');
  });
});

describe('createBatchEmitter', () => {
  it('starts with size 0', () => {
    const emitter = createBatchEmitter();
    expect(emitter.size).toBe(0);
  });

  it('adds events and tracks size', () => {
    const emitter = createBatchEmitter();
    const event = createUsageEvent('lic_a', 'user_1', 'BASIC', 100);
    emitter.addEvent(event);
    expect(emitter.size).toBe(1);
    emitter.addEvent(event);
    expect(emitter.size).toBe(2);
  });

  it('flushes events to queue', async () => {
    const emitter = createBatchEmitter();
    const mockQueue = { send: vi.fn().mockResolvedValue(undefined) };
    const event = createUsageEvent('lic_a', 'user_1', 'BASIC', 100);
    emitter.addEvent(event);

    const flushed = await emitter.flush(mockQueue as never);
    expect(flushed).toBe(1);
    expect(mockQueue.send).toHaveBeenCalledTimes(1);
  });

  it('resets size after flush', async () => {
    const emitter = createBatchEmitter();
    const mockQueue = { send: vi.fn().mockResolvedValue(undefined) };
    emitter.addEvent(createUsageEvent('lic_a', 'user_1', 'BASIC', 100));
    await emitter.flush(mockQueue as never);
    expect(emitter.size).toBe(0);
  });

  it('returns 0 when flushing empty queue', async () => {
    const emitter = createBatchEmitter();
    const mockQueue = { send: vi.fn() };
    const flushed = await emitter.flush(mockQueue as never);
    expect(flushed).toBe(0);
    expect(mockQueue.send).not.toHaveBeenCalled();
  });

  it('sends all events concurrently on flush', async () => {
    const emitter = createBatchEmitter(5);
    const mockQueue = { send: vi.fn().mockResolvedValue(undefined) };
    emitter.addEvent(createUsageEvent('lic_a', 'user_1', 'BASIC', 100));
    emitter.addEvent(createUsageEvent('lic_b', 'user_2', 'PREMIUM', 200));
    emitter.addEvent(createUsageEvent('lic_c', 'user_3', 'ENTERPRISE', 300));

    const flushed = await emitter.flush(mockQueue as never);
    expect(flushed).toBe(3);
    expect(mockQueue.send).toHaveBeenCalledTimes(3);
  });

  it('handles queue send failure gracefully', async () => {
    const emitter = createBatchEmitter();
    const mockQueue = { send: vi.fn().mockRejectedValue(new Error('Queue full')) };
    emitter.addEvent(createUsageEvent('lic_a', 'user_1', 'BASIC', 100));

    await expect(emitter.flush(mockQueue as never)).rejects.toThrow('Queue full');
  });
});

describe('emitUsageEvent', () => {
  it('sends event to queue', async () => {
    const mockQueue = { send: vi.fn().mockResolvedValue(undefined) };
    await emitUsageEvent(mockQueue as never, 'lic_a', 'user_1', 'BASIC', 500);
    expect(mockQueue.send).toHaveBeenCalledTimes(1);
    const sent = mockQueue.send.mock.calls[0][0] as { licenseNonce: string; usageCount: number };
    expect(sent.licenseNonce).toBe('lic_a');
    expect(sent.usageCount).toBe(500);
  });
});

describe('emitBatchedUsageEvents', () => {
  it('sends all events concurrently', async () => {
    const mockQueue = { send: vi.fn().mockResolvedValue(undefined) };
    const events = [
      createUsageEvent('lic_a', 'user_1', 'BASIC', 100),
      createUsageEvent('lic_b', 'user_2', 'PREMIUM', 200),
    ];
    await emitBatchedUsageEvents(mockQueue as never, events);
    expect(mockQueue.send).toHaveBeenCalledTimes(2);
  });

  it('handles empty events array', async () => {
    const mockQueue = { send: vi.fn() };
    await emitBatchedUsageEvents(mockQueue as never, []);
    expect(mockQueue.send).not.toHaveBeenCalled();
  });
});

describe('validateUsageEvent', () => {
  it('returns true for valid event', () => {
    const event = createUsageEvent('lic_a', 'user_1', 'BASIC', 100);
    expect(validateUsageEvent(event)).toBe(true);
  });

  it('returns false for null', () => {
    expect(validateUsageEvent(null)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(validateUsageEvent('string')).toBe(false);
  });

  it('returns false when missing required fields', () => {
    expect(validateUsageEvent({ licenseNonce: 'lic_a' })).toBe(false);
  });

  it('returns false when fields have wrong types', () => {
    expect(validateUsageEvent({
      licenseNonce: 123,
      userId: 'user_1',
      tier: 'BASIC',
      usageCount: 100,
      overageCount: 0,
      overageFee: 0,
      timestamp: Date.now(),
      idempotencyKey: 'key',
    })).toBe(false);
  });

  it('accepts optional service and billingPeriod', () => {
    const event = createUsageEvent('lic_a', 'user_1', 'BASIC', 100, 'video-gen');
    expect(validateUsageEvent(event)).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackWithCircuitBreaker } from './realtime-tracker';
import { getRealTimeUsage, incrementRealTimeUsage, invalidateRealTimeCache } from './realtime-tracker-kv-ops';

// Simple in-memory simulator for Redis Hashes
let redisMockStore: Record<string, Record<string, number>> = {};
let redisTtlStore: Record<string, number> = {};

const mockKv = {
  hget: vi.fn(async (key: string, field: string) => {
    return redisMockStore[key]?.[field] ?? null;
  }),
  hset: vi.fn(async (key: string, data: Record<string, string | number>) => {
    if (!redisMockStore[key]) redisMockStore[key] = {};
    for (const [f, val] of Object.entries(data)) {
      redisMockStore[key][f] = typeof val === 'number' ? val : parseInt(val, 10);
    }
    return 1;
  }),
  eval: vi.fn(async (luaScript: string, keys: string[], args: string[]) => {
    const key = keys[0];
    const field = args[0];
    const delta = parseInt(args[1], 10);
    const ttl = parseInt(args[2], 10);
    if (!redisMockStore[key]) redisMockStore[key] = {};
    const current = redisMockStore[key][field] ?? 0;
    const updated = current + delta;
    redisMockStore[key][field] = updated;
    redisTtlStore[key] = ttl;
    return 1; // Lua returns 1 on success
  }),
  expire: vi.fn(async (key: string, ttl: number) => {
    redisTtlStore[key] = ttl;
  }),
  del: vi.fn(async (key: string) => {
    delete redisMockStore[key];
    delete redisTtlStore[key];
    return 1;
  })
};

vi.mock('@/seed/utils/redis-client', () => ({ getKvClient: () => mockKv }));

// Mock the circuit breaker to always succeed
vi.mock('./realtime-tracker-circuit-breaker', () => ({
  canPassCircuitBreaker: vi.fn().mockResolvedValue({ allowed: true }),
  recordCircuitSuccess: vi.fn().mockResolvedValue(undefined),
  recordCircuitFailure: vi.fn().mockResolvedValue(undefined),
}));

describe('Real-Time Tracker KV and Circuit Breaker', () => {
  beforeEach(() => {
    redisMockStore = {};
    redisTtlStore = {};
    vi.clearAllMocks();
  });

  describe('incrementRealTimeUsage', () => {
    it('should increment a field in the hash using pipeline and set TTL', async () => {
      const userId = 'user-1';
      const nonce = 'license-nonce-abc';
      const windowStart = 1600000000;
      
      const newCredits = await incrementRealTimeUsage(userId, nonce, windowStart, 5);
      expect(newCredits).toBe(5);
      expect(redisMockStore[`usage:${userId}:${nonce}`]?.[windowStart.toString()]).toBe(5);
      expect(redisTtlStore[`usage:${userId}:${nonce}`]).toBe(3600);
      
      const updatedCredits = await incrementRealTimeUsage(userId, nonce, windowStart, 10);
      expect(updatedCredits).toBe(15);
      expect(redisMockStore[`usage:${userId}:${nonce}`]?.[windowStart.toString()]).toBe(15);
    });
  });

  describe('getRealTimeUsage', () => {
    it('should retrieve credits using hget for a specific window', async () => {
      const userId = 'user-2';
      const nonce = 'license-nonce-xyz';
      const windowStart = 1700000000;

      // Ensure it returns null if key/field does not exist
      const initial = await getRealTimeUsage(userId, nonce, windowStart);
      expect(initial).toBeNull();

      // Setup state
      await incrementRealTimeUsage(userId, nonce, windowStart, 8);

      const usage = await getRealTimeUsage(userId, nonce, windowStart);
      expect(usage).not.toBeNull();
      expect(usage?.currentCredits).toBe(8);
      expect(usage?.windowStart).toBe(windowStart);
    });
  });

  describe('invalidateRealTimeCache', () => {
    it('should delete the entire key structure', async () => {
      const userId = 'user-3';
      const nonce = 'license-nonce-del';
      const windowStart = 1800000000;

      await incrementRealTimeUsage(userId, nonce, windowStart, 25);
      expect(redisMockStore[`usage:${userId}:${nonce}`]).toBeDefined();

      await invalidateRealTimeCache(userId, nonce);
      expect(redisMockStore[`usage:${userId}:${nonce}`]).toBeUndefined();
    });
  });

  describe('trackWithCircuitBreaker', () => {
    it('should perform increments and return currentCredits', async () => {
      const userId = 'user-4';
      const nonce = 'license-nonce-track';
      const result1 = await trackWithCircuitBreaker(userId, nonce, 'pro', 10);
      expect(result1.allowed).toBe(true);
      expect(result1.currentCredits).toBe(10);

      const result2 = await trackWithCircuitBreaker(userId, nonce, 'pro', 20);
      expect(result2.allowed).toBe(true);
      expect(result2.currentCredits).toBe(30);
    });

    it('should handle concurrent track calls correctly', async () => {
      const userId = 'user-concurrent';
      const nonce = 'license-nonce-concurrent';
      
      // Perform 5 concurrent track calls of 5 credits each
      const promises = Array.from({ length: 5 }).map(() =>
        trackWithCircuitBreaker(userId, nonce, 'pro', 5)
      );

      const results = await Promise.all(promises);
      results.forEach(res => {
        expect(res.allowed).toBe(true);
      });

      // Since all ran concurrently, their returned currentCredits will reflect their respective
      // points in the execution. But the final value in Redis must be exactly 25.
      const now = Date.now();
      const windowStart = Math.floor(now / 1000) * 1000;
      const usage = await getRealTimeUsage(userId, nonce, windowStart);
      expect(usage?.currentCredits).toBe(25);
    });
  });
});

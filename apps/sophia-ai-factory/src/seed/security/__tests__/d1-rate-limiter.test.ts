/**
 * D1-Backed Rate Limiter Tests (TDD)
 *
 * Tests for cross-isolate D1 rate limiting.
 * Uses vi.mock to replace getD1 with a controlled in-memory store.
 *
 * Test cases:
 * 1. D1 counter increments atomically via INSERT OR REPLACE
 * 2. checkD1RateLimit returns {allowed: false} when counter exceeds maxRequests
 * 3. Sliding window — old entries outside current window don't count
 * 4. Different IPs have independent counters
 * 5. Expired entries are cleaned up inline
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkD1RateLimit, AUTH_RATE_LIMIT_CONFIG } from '../d1-rate-limiter';

// Mock getD1 from @/seed/db/client
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

import { getD1 } from '@/seed/db/client';

describe('checkD1RateLimit', () => {
  // In-memory store simulating the d1_rate_limits table
  let store: Map<string, { counter: number; window_start: number }>;

  /**
   * Create a controlled mock D1 binding backed by `store`.
   * Each SQL operation maps to store mutations:
   * - DELETE: removes entries where window_start < cutoff
   * - SELECT: returns entry for client_id from store
   * - UPDATE: increments counter for client_id
   * - INSERT OR REPLACE: sets counter=1 with given window_start
   * - CREATE TABLE: no-op (always succeeds)
   */
  function createMockD1() {
    return {
      prepare: vi.fn((sql: string) => {
        if (sql.startsWith('CREATE TABLE')) {
          return {
            bind: () => ({
              first: vi.fn().mockResolvedValue(null),
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          };
        }

        if (sql.startsWith('DELETE FROM')) {
          return {
            bind: (...args: unknown[]) => {
              const cutoff = args[0] as number;
              for (const [key, entry] of store.entries()) {
                if (entry.window_start < cutoff) store.delete(key);
              }
              return {
                first: vi.fn().mockResolvedValue(null),
                run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 0 } }),
              };
            },
          };
        }

        if (sql.startsWith('SELECT counter')) {
          return {
            bind: (...args: unknown[]) => {
              const clientId = args[0] as string;
              const entry = store.get(clientId) ?? null;
              const record = entry
                ? { counter: entry.counter, window_start: entry.window_start }
                : null;
              return {
                first: vi.fn().mockResolvedValue(record),
                run: vi.fn().mockResolvedValue({ success: true }),
              };
            },
          };
        }

        if (sql.startsWith('UPDATE')) {
          return {
            bind: (...args: unknown[]) => {
              const clientId = args[0] as string;
              const entry = store.get(clientId);
              if (entry) {
                entry.counter += 1;
              }
              return {
                first: vi.fn().mockResolvedValue(null),
                run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
              };
            },
          };
        }

        if (sql.startsWith('INSERT OR REPLACE')) {
          return {
            bind: (...args: unknown[]) => {
              const clientId = args[0] as string;
              const counter = args[1] as number;
              const windowStart = args[2] as number;
              store.set(clientId, { counter, window_start: windowStart });
              return {
                first: vi.fn().mockResolvedValue(null),
                run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
              };
            },
          };
        }

        // Fallback: no-op chain
        return {
          bind: () => ({
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        };
      }),
    };
  }

  beforeEach(() => {
    store = new Map();
    vi.mocked(getD1).mockReturnValue(createMockD1() as never);
  });

  // ── Test 1: D1 counter increments atomically via INSERT OR REPLACE ──────────
  it('increments counter via INSERT OR REPLACE when no existing entry', async () => {
    const result = await checkD1RateLimit('client-1');

    expect(result.allowed).toBe(true);
    // maxRequests(10) - 1(first request) = 9 remaining
    expect(result.remaining).toBe(9);
  });

  // ── Test 2: Returns {allowed: false} when counter exceeds maxRequests ──────
  it('returns allowed false when counter exceeds maxRequests', async () => {
    // Pre-fill store with counter at the limit, within current window
    const now = Math.floor(Date.now() / 1000);
    store.set('client-1', { counter: 10, window_start: now });

    const result = await checkD1RateLimit('client-1', {
      maxRequests: 10,
      windowSeconds: 60,
    });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  // ── Test 3: Sliding window — old entries outside window don't count ────────
  it('resets counter when window has expired', async () => {
    // Pre-fill store with counter at max but with an old window (2 min ago)
    const oldWindowStart = Math.floor(Date.now() / 1000) - 120;
    store.set('client-1', { counter: 10, window_start: oldWindowStart });

    // 60-second window → old entry should be reset
    const result = await checkD1RateLimit('client-1', {
      maxRequests: 10,
      windowSeconds: 60,
    });

    expect(result.allowed).toBe(true);
    // After reset (counter=1), remaining should be 9
    expect(result.remaining).toBe(9);
  });

  // ── Test 4: Different IPs have independent counters ──────────────────────
  it('tracks different client IDs independently', async () => {
    const now = Math.floor(Date.now() / 1000);

    // Exhaust client-1
    store.set('client-1', { counter: 10, window_start: now });

    // client-2 should have a fresh counter
    const result = await checkD1RateLimit('client-2', {
      maxRequests: 10,
      windowSeconds: 60,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  // ── Test 5: Expired entries are cleaned up inline ──────────────────────────
  it('cleans up expired entries during check', async () => {
    const oldTime = Math.floor(Date.now() / 1000) - 120; // 2 min ago

    // Add expired entries
    store.set('expired-1', { counter: 5, window_start: oldTime });
    store.set('expired-2', { counter: 3, window_start: oldTime - 60 });

    // Trigger check (which runs inline cleanup)
    await checkD1RateLimit('fresh-client', {
      maxRequests: 10,
      windowSeconds: 60,
    });

    // Expired entries should have been removed
    expect(store.has('expired-1')).toBe(false);
    expect(store.has('expired-2')).toBe(false);
  });
});

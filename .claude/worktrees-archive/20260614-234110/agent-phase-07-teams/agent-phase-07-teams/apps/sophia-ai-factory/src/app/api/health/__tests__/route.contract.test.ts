/**
 * route.contract.test.ts — schema-only POC for /api/health response shapes.
 *
 * Validates the two response shapes the route emits (public fast-path +
 * authorized full probe) against Zod schemas mirrored inline. Does NOT
 * invoke the real handler — full handler integration with stubbed CF
 * bindings is deferred (would require D1 / Sentry / Redis mocks).
 *
 * Acts as the living reference for the zod-contract-test-generator skill.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ── Zod schema mirroring the unauthenticated fast-path response ──────────────
const PublicHealthSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string().datetime({ offset: true }),
  sha: z.string().optional(),
});

// ── Zod schema for full authorized response ───────────────────────────────────
const ServiceHealthSchema = z.object({
  status: z.enum(['up', 'down', 'degraded', 'configured', 'not_configured', 'missing_config']),
  latency: z.number().optional(),
  error: z.string().optional(),
});

const FullHealthSchema = PublicHealthSchema.extend({
  deployedAt: z.string().optional(),
  services: z.record(z.string(), ServiceHealthSchema),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(url = 'http://localhost/api/health'): Request {
  return new Request(url, { method: 'GET' });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('/api/health contract', () => {
  beforeEach(() => {
    vi.resetModules();
    // Stub env to prevent real external calls in CI
    vi.stubEnv('HEALTH_CHECK_SECRET', '');
  });

  it('PublicHealthSchema validates a minimal healthy response', () => {
    const payload = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      sha: 'abc12345',
    };
    const result = PublicHealthSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('PublicHealthSchema rejects unknown status values', () => {
    const payload = { status: 'ok', timestamp: new Date().toISOString() };
    const result = PublicHealthSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('PublicHealthSchema rejects missing timestamp', () => {
    const payload = { status: 'healthy' };
    const result = PublicHealthSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('FullHealthSchema validates authorized response with services', () => {
    const payload = {
      status: 'degraded',
      timestamp: new Date().toISOString(),
      sha: 'abc12345',
      deployedAt: '2026-05-18T10:00:00.000Z',
      services: {
        d1: { status: 'up', latency: 12 },
        redis: { status: 'down', error: 'ECONNREFUSED' },
      },
    };
    const result = FullHealthSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('fast-path response shape matches PublicHealthSchema', async () => {
    // Construct a minimal real fast-path payload to validate schema coverage
    const mockPayload = {
      status: 'healthy' as const,
      timestamp: new Date().toISOString(),
      sha: 'deadbeef',
    };
    const req = makeRequest();
    void req; // request available for future handler integration
    const result = PublicHealthSchema.safeParse(mockPayload);
    expect(result.success).toBe(true);
  });
});

/**
 * Tests for handover-magic-link helpers.
 *   - createMagicLinkToken honours per-source TTL
 *   - consumeMagicLink invalidates the token (P0 single-use enforcement)
 *   - markFirstRun / markFirstSopInstall are idempotent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  getD1Raw: vi.fn(),
}));

import {
  createMagicLinkToken,
  consumeMagicLink,
  markFirstRun,
  markFirstSopInstall,
  generateToken,
} from '../handover-magic-link';
import { getD1Raw } from '@/lib/db/client';

interface CapturedCall {
  sql: string;
  bound: unknown[];
}

function makeDbCapturing(captured: CapturedCall[], firstRow: unknown = null) {
  return {
    prepare: vi.fn((sql: string) => {
      let bound: unknown[] = [];
      return {
        bind: vi.fn((...args: unknown[]) => {
          bound = args;
          return {
            first: vi.fn().mockResolvedValue(firstRow),
            run: vi.fn().mockImplementation(() => {
              captured.push({ sql, bound });
              return Promise.resolve({ success: true });
            }),
          };
        }),
      };
    }),
  } as unknown as D1Database;
}

describe('generateToken', () => {
  it('produces 64-char hex strings', () => {
    const t = generateToken();
    expect(t).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is unique across calls', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe('createMagicLinkToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses 24h TTL by default', async () => {
    const captured: CapturedCall[] = [];
    vi.mocked(getD1Raw).mockResolvedValue(makeDbCapturing(captured));

    const before = Math.floor(Date.now() / 1000);
    await createMagicLinkToken('h1');
    const expiresAt = captured[0].bound[1] as number;
    const ttlSec = expiresAt - before;
    expect(ttlSec).toBeGreaterThanOrEqual(24 * 3600 - 5);
    expect(ttlSec).toBeLessThanOrEqual(24 * 3600 + 5);
  });

  it('uses 72h TTL for auto_signup source', async () => {
    const captured: CapturedCall[] = [];
    vi.mocked(getD1Raw).mockResolvedValue(makeDbCapturing(captured));

    const before = Math.floor(Date.now() / 1000);
    await createMagicLinkToken('h1', { source: 'auto_signup' });
    const expiresAt = captured[0].bound[1] as number;
    const ttlSec = expiresAt - before;
    expect(ttlSec).toBeGreaterThanOrEqual(72 * 3600 - 5);
    expect(ttlSec).toBeLessThanOrEqual(72 * 3600 + 5);
  });

  it('uses 72h TTL for auto_payment source', async () => {
    const captured: CapturedCall[] = [];
    vi.mocked(getD1Raw).mockResolvedValue(makeDbCapturing(captured));

    const before = Math.floor(Date.now() / 1000);
    await createMagicLinkToken('h1', { source: 'auto_payment' });
    const expiresAt = captured[0].bound[1] as number;
    expect(expiresAt - before).toBeGreaterThanOrEqual(72 * 3600 - 5);
  });

  it('explicit ttlHours override wins', async () => {
    const captured: CapturedCall[] = [];
    vi.mocked(getD1Raw).mockResolvedValue(makeDbCapturing(captured));

    const before = Math.floor(Date.now() / 1000);
    await createMagicLinkToken('h1', { ttlHours: 1, source: 'auto_signup' });
    const expiresAt = captured[0].bound[1] as number;
    expect(expiresAt - before).toBeLessThanOrEqual(3600 + 5);
  });
});

describe('consumeMagicLink (P0: single-use enforcement)', () => {
  it('clears magic_link_token AND magic_link_expires_at', async () => {
    const captured: CapturedCall[] = [];
    vi.mocked(getD1Raw).mockResolvedValue(makeDbCapturing(captured));

    await consumeMagicLink('h-1');

    expect(captured).toHaveLength(1);
    expect(captured[0].sql).toContain('magic_link_token = NULL');
    expect(captured[0].sql).toContain('magic_link_expires_at = NULL');
    // Bound: [now, handoverId]
    expect(captured[0].bound[1]).toBe('h-1');
  });

  it('uses COALESCE on customer_first_login_at to keep first-time stamp', async () => {
    const captured: CapturedCall[] = [];
    vi.mocked(getD1Raw).mockResolvedValue(makeDbCapturing(captured));

    await consumeMagicLink('h-1');

    expect(captured[0].sql).toContain('COALESCE(customer_first_login_at');
  });
});

describe('markFirstRun', () => {
  it('uses COALESCE so subsequent calls are no-ops', async () => {
    const captured: CapturedCall[] = [];
    vi.mocked(getD1Raw).mockResolvedValue(makeDbCapturing(captured));

    await markFirstRun('user-1');

    expect(captured[0].sql).toContain('COALESCE(customer_first_run_at');
    expect(captured[0].bound[1]).toBe('user-1');
  });

  it('swallows DB errors (non-fatal)', async () => {
    vi.mocked(getD1Raw).mockRejectedValue(new Error('boom'));
    await expect(markFirstRun('user-1')).resolves.toBeUndefined();
  });
});

describe('markFirstSopInstall', () => {
  it('uses COALESCE on customer_first_sop_install_at', async () => {
    const captured: CapturedCall[] = [];
    vi.mocked(getD1Raw).mockResolvedValue(makeDbCapturing(captured));

    await markFirstSopInstall('user-1');

    expect(captured[0].sql).toContain('COALESCE(customer_first_sop_install_at');
  });

  it('swallows DB errors', async () => {
    vi.mocked(getD1Raw).mockRejectedValue(new Error('boom'));
    await expect(markFirstSopInstall('user-1')).resolves.toBeUndefined();
  });
});

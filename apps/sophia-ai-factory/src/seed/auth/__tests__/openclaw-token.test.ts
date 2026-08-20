/**
 * Unit tests for openclaw-token.ts (v2 — JTI-bearing, revocation-aware)
 *
 * Coverage:
 *   - verifyOpenclawToken: valid token → returns VerifiedOpenclawToken
 *   - verifyOpenclawToken: expired token → null
 *   - verifyOpenclawToken: tampered signature → null
 *   - verifyOpenclawToken: revoked JTI → null
 *   - verifyOpenclawToken: v1 legacy (3-part) token → null (cannot revoke)
 *   - revokeOpenclawToken: calls D1 INSERT
 *   - missing secret → null
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (factories must not reference outer variables — hoisted by vitest) ──

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/seed/utils/to-error', () => ({
  toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn().mockResolvedValue(null),
}));

import { verifyOpenclawToken, revokeOpenclawToken, hmacBase64url, generateJti } from '@/seed/auth/openclaw-token';
import { getD1 } from '@/seed/db/client';

const mockGetD1 = vi.mocked(getD1);
const TEST_SECRET = 'test-secret-for-openclaw-token-tests';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeD1Mock(revokedSet: Set<string>) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => {
      const stmt = {
        _sql: sql,
        _args: [] as unknown[],
        bind(...args: unknown[]) {
          this._args = args;
          return this;
        },
        async first() {
          if (this._sql.includes('openclaw_revoked_tokens') && this._sql.includes('SELECT')) {
            const jti = this._args[0] as string;
            return revokedSet.has(jti) ? { '1': 1 } : null;
          }
          return null;
        },
        run: vi.fn().mockResolvedValue(undefined),
      };
      return stmt;
    }),
  };
}

async function mintToken(userId: string, ttlSeconds: number, jti?: string): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = nowSec + ttlSeconds;
  const tokenJti = jti ?? generateJti();
  const payload = `${userId}.${expiresAt}.${tokenJti}`;
  const sig = await hmacBase64url(payload, TEST_SECRET);
  return `${payload}.${sig}`;
}

let revokedSet: Set<string>;

beforeEach(() => {
  vi.clearAllMocks();
  revokedSet = new Set<string>();
  mockGetD1.mockResolvedValue(makeD1Mock(revokedSet) as unknown as D1Database);
  process.env.BETTER_AUTH_SECRET = TEST_SECRET;
  delete process.env.JWT_SECRET;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('verifyOpenclawToken — happy path', () => {
  it('returns VerifiedOpenclawToken for a valid v2 token', async () => {
    const raw = await mintToken('user-abc', 86_400);
    const result = await verifyOpenclawToken(raw);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe('user-abc');
    expect(result?.jti).toBeTruthy();
    const nowSec = Math.floor(Date.now() / 1000);
    expect(result!.expiresAt).toBeGreaterThan(nowSec);
    expect(result!.expiresAt).toBeLessThanOrEqual(nowSec + 86_400 + 2);
  });

  it('embeds JTI in returned object', async () => {
    const jti = generateJti();
    const raw = await mintToken('user-xyz', 3600, jti);
    const result = await verifyOpenclawToken(raw);
    expect(result?.jti).toBe(jti);
  });
});

describe('verifyOpenclawToken — TTL', () => {
  it('returns null for expired token', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const jti = generateJti();
    const payload = `user-expired.${nowSec - 1}.${jti}`;
    const sig = await hmacBase64url(payload, TEST_SECRET);
    const raw = `${payload}.${sig}`;
    expect(await verifyOpenclawToken(raw)).toBeNull();
  });
});

describe('verifyOpenclawToken — signature', () => {
  it('returns null when signature is tampered', async () => {
    const raw = await mintToken('user-tamper', 3600);
    const parts = raw.split('.');
    parts[3] = 'invalidsignature1234';
    expect(await verifyOpenclawToken(parts.join('.'))).toBeNull();
  });
});

describe('verifyOpenclawToken — v1 legacy token (3-part)', () => {
  it('rejects v1 tokens (no JTI)', async () => {
    // v1 format: userId.expiresAt.sig (3 parts)
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = `user-v1.${nowSec + 3600}`;
    const sig = await hmacBase64url(payload, TEST_SECRET);
    const raw = `${payload}.${sig}`;
    expect(await verifyOpenclawToken(raw)).toBeNull();
  });
});

describe('verifyOpenclawToken — revocation', () => {
  it('returns null for a revoked JTI', async () => {
    const jti = generateJti();
    const raw = await mintToken('user-revoke', 3600, jti);
    revokedSet.add(jti);
    expect(await verifyOpenclawToken(raw)).toBeNull();
  });

  it('returns VerifiedOpenclawToken for non-revoked JTI', async () => {
    const jti = generateJti();
    const raw = await mintToken('user-active', 3600, jti);
    const result = await verifyOpenclawToken(raw);
    expect(result).not.toBeNull();
    expect(result?.jti).toBe(jti);
  });
});

describe('revokeOpenclawToken', () => {
  it('calls D1 INSERT for the given JTI', async () => {
    const mockDb = makeD1Mock(revokedSet);
    mockGetD1.mockResolvedValue(mockDb as unknown as D1Database);

    await revokeOpenclawToken('test-jti-to-revoke', 'test reason');

    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO openclaw_revoked_tokens'),
    );
  });
});

describe('missing secret', () => {
  it('returns null when BETTER_AUTH_SECRET is absent', async () => {
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.JWT_SECRET;
    const raw = await mintToken('user-nosecret', 3600);
    expect(await verifyOpenclawToken(raw)).toBeNull();
  });
});

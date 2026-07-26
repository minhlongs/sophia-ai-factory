/**
 * Unit tests for middleware/social-tier-gate.ts
 *
 * Validates BASIC-tier users are redirected from /dashboard/social/* to
 * the pricing upsell page with a bilingual flash message.
 *
 * Approach: no vi.mock — set globalThis.__env__ directly to inject a
 * per-test D1 stub, let TIER_SOCIAL_LIMITS load from real module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applySocialTierGate } from '../social-tier-gate';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeNextRequest(pathname: string): Request {
  const req = new Request(`http://localhost:3000${pathname}`) as Request & { nextUrl: { pathname: string } };
  req.nextUrl = { pathname };
  return req;
}

function d1Returning(tier: string | null, plan: string | null): D1Database {
  const firstMock = vi.fn().mockResolvedValue({ tier, plan });
  const bindMock = vi.fn().mockReturnValue({ first: firstMock });
  const prepareMock = vi.fn().mockReturnValue({ bind: bindMock, first: firstMock });
  return {
    prepare: prepareMock,
    dump: vi.fn(),
    batch: vi.fn(),
    exec: vi.fn(),
  } as unknown as D1Database;
}

// ── Test subject setup ─────────────────────────────────────────────────────────
//
// applySocialTierGate calls getD1() → reads globalThis.__env__ (double-underscore).
// We set it per-test so resolveTier can query the tier row.

let envBackup: Record<string, unknown> | undefined;

function setEnv(db: D1Database) {
  envBackup = (globalThis as unknown as Record<string, Record<string, unknown>>).__env__;
  (globalThis as unknown as Record<string, Record<string, unknown>>).__env__ = { DB: db };
}

function restoreEnv() {
  if (envBackup) {
    (globalThis as unknown as Record<string, Record<string, unknown>>).__env__ = envBackup;
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('applySocialTierGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    restoreEnv();
  });

  // ── Non-social paths ────────────────────────────────────────────────────

  describe('non-social paths → null (no redirect)', () => {
    it('/dashboard/videos', async () => {
      expect(await applySocialTierGate(makeNextRequest('/dashboard/videos'), 'uid')).toBeNull();
    });

    it('/settings', async () => {
      expect(await applySocialTierGate(makeNextRequest('/settings'), 'uid')).toBeNull();
    });

    it('/', async () => {
      expect(await applySocialTierGate(makeNextRequest('/'), 'uid')).toBeNull();
    });
  });

  // ── BASIC tier → redirect ──────────────────────────────────────────────

  describe('BASIC tier → redirect to /dashboard/pricing', () => {
    it('/dashboard/social/channels → 302 + social_locked', async () => {
      setEnv(d1Returning('BASIC', 'basic'));
      const r = await applySocialTierGate(makeNextRequest('/vi/dashboard/social/channels'), 'uid');
      expect(r).not.toBeNull();
      const loc = r!.headers.get('location')!;
      expect(loc).toContain('/dashboard/pricing');
      expect(loc).toContain('social_locked');
      expect(r!.status).toBe(302);
    });

    it('/dashboard/social/calendar', async () => {
      setEnv(d1Returning('BASIC', 'basic'));
      const r = await applySocialTierGate(makeNextRequest('/vi/dashboard/social/calendar'), 'uid');
      expect(r).not.toBeNull();
      expect(r!.headers.get('location')).toContain('/dashboard/pricing');
    });

    it('/dashboard/social/history', async () => {
      setEnv(d1Returning('BASIC', 'basic'));
      expect(await applySocialTierGate(makeNextRequest('/vi/dashboard/social/history'), 'uid')).not.toBeNull();
    });

    it('/dashboard/social/metrics', async () => {
      setEnv(d1Returning('BASIC', 'basic'));
      expect(await applySocialTierGate(makeNextRequest('/vi/dashboard/social/metrics'), 'uid')).not.toBeNull();
    });

    it('VI locale → "Nâng cấp" flash message', async () => {
      setEnv(d1Returning('BASIC', 'basic'));
      const r = await applySocialTierGate(makeNextRequest('/vi/dashboard/social/channels'), 'uid');
      expect(decodeURIComponent(r!.headers.get('location')!)).toContain('Nâng cấp');
    });

    it('EN locale → "Upgrade" flash message', async () => {
      setEnv(d1Returning('BASIC', 'basic'));
      const r = await applySocialTierGate(makeNextRequest('/en/dashboard/social/channels'), 'uid');
      expect(decodeURIComponent(r!.headers.get('location')!)).toContain('Upgrade');
    });
  });

  // ── PREMIUM+ tiers → pass ──────────────────────────────────────────────

  describe('PREMIUM+ tiers — access granted', () => {
    it('PREMIUM → null', async () => {
      setEnv(d1Returning('PREMIUM', 'premium'));
      expect(await applySocialTierGate(makeNextRequest('/vi/dashboard/social/channels'), 'uid')).toBeNull();
    });

    it('ENTERPRISE → null', async () => {
      setEnv(d1Returning('ENTERPRISE', 'enterprise'));
      expect(await applySocialTierGate(makeNextRequest('/vi/dashboard/social/channels'), 'uid')).toBeNull();
    });

    it('MASTER → null', async () => {
      setEnv(d1Returning('MASTER', 'master'));
      expect(await applySocialTierGate(makeNextRequest('/vi/dashboard/social/channels'), 'uid')).toBeNull();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocialChannelQuotaEnforcer, socialChannelQuota } from './social-channel-quota';

// ── Mock D1 factory (mutable so each test can set return value ───────────────────
type D1Stub = {
  prepare: ReturnType<typeof vi.fn>;
};

const mockD1: D1Stub = {
  prepare: vi.fn(),
};

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(() => mockD1),
}));

// ── Mock getUserTier ────────────────────────────────────────────────────────────
let mockTier = 'PREMIUM';
vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn(async () => mockTier),
}));

// ── Mock logger ─────────────────────────────────────────────────────────────────
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { error: vi.fn() },
}));

// Import after mocks
import type { Database } from '@/seed/db/client';

// ── Helpers ────────────────────────────────────────────────────────────────────
function mockChannelCount(count: number) {
  mockD1.prepare = vi.fn(() => ({
    bind: vi.fn(() => ({
      first: vi.fn().mockResolvedValue({ cnt: count }),
    })),
  })) as unknown as D1Stub['prepare'];
}

function resetD1Mock() {
  mockD1.prepare = vi.fn(() => ({
    bind: vi.fn(() => ({
      first: vi.fn().mockResolvedValue({ cnt: 0 }),
    })),
  })) as unknown as D1Stub['prepare'];
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('TIER_SOCIAL_LIMITS (imported by enforcer)', () => {
  it('BASIC disables social', async () => {
    const { TIER_SOCIAL_LIMITS } = await import('@/seed/config/tiers/tier-social-limits');
    expect(TIER_SOCIAL_LIMITS.BASIC.socialEnabled).toBe(false);
    expect(TIER_SOCIAL_LIMITS.BASIC.maxChannels).toBe(0);
  });

  it('PREMIUM allows 5 channels / 50 publishes', async () => {
    const { TIER_SOCIAL_LIMITS } = await import('@/seed/config/tiers/tier-social-limits');
    expect(TIER_SOCIAL_LIMITS.PREMIUM.socialEnabled).toBe(true);
    expect(TIER_SOCIAL_LIMITS.PREMIUM.maxChannels).toBe(5);
    expect(TIER_SOCIAL_LIMITS.PREMIUM.maxPublishPerMonth).toBe(50);
  });

  it('MASTER has Infinity limits', async () => {
    const { TIER_SOCIAL_LIMITS } = await import('@/seed/config/tiers/tier-social-limits');
    expect(TIER_SOCIAL_LIMITS.MASTER.maxChannels).toBe(Infinity);
    expect(TIER_SOCIAL_LIMITS.MASTER.maxPublishPerMonth).toBe(Infinity);
  });
});

describe('SocialChannelQuotaEnforcer.canAddChannel', () => {
  beforeEach(() => {
    mockTier = 'PREMIUM';
    resetD1Mock();
  });

  it('BASIC tier -> failure (no DB call needed)', async () => {
    mockTier = 'BASIC';
    const enforcer = new SocialChannelQuotaEnforcer();
    const res = await enforcer.canAddChannel('user-1');
    expect(res.ok).toBe(false);
    expect(
      (res as { ok: false; error: { code: string } }).error.code,
    ).toBe('SOCIAL_TIER_LOCKED');
  });

  it('MASTER with 0 channels -> always allowed, no DB needed', async () => {
    mockTier = 'MASTER';
    const enforcer = new SocialChannelQuotaEnforcer();
    const res = await enforcer.canAddChannel('user-1');
    expect(res.ok).toBe(true);
  });

  it('PREMIUM with 4/5 channels -> allowed', async () => {
    mockChannelCount(4);
    const enforcer = new SocialChannelQuotaEnforcer();
    const res = await enforcer.canAddChannel('user-1');
    expect(res.ok).toBe(true);
  });

  it('PREMIUM with 5/5 channels -> failure (limit reached)', async () => {
    mockChannelCount(5);
    const enforcer = new SocialChannelQuotaEnforcer();
    const res = await enforcer.canAddChannel('user-1');
    expect(res.ok).toBe(false);
    expect(
      (res as { ok: false; error: { code: string } }).error.code,
    ).toBe('SOCIAL_CHANNEL_LIMIT_REACHED');
  });
});

describe('SocialChannelQuotaEnforcer.enforcePublishQuota', () => {
  beforeEach(() => {
    mockTier = 'PREMIUM';
    resetD1Mock();
  });

  it('MASTER -> always allowed', async () => {
    mockTier = 'MASTER';
    const enforcer = new SocialChannelQuotaEnforcer();
    const res = await enforcer.enforcePublishQuota('user-1', new Date());
    expect(res.ok).toBe(true);
  });

  it('BASIC -> failure (no social access)', async () => {
    mockTier = 'BASIC';
    const enforcer = new SocialChannelQuotaEnforcer();
    const res = await enforcer.enforcePublishQuota('user-1', new Date());
    expect(res.ok).toBe(false);
    expect(
      (res as { ok: false; error: { code: string } }).error.code,
    ).toBe('SOCIAL_TIER_LOCKED');
  });
});

describe('SocialChannelQuotaEnforcer.getQuotaStatus', () => {
  beforeEach(() => {
    mockTier = 'BASIC';
    resetD1Mock();
  });

  it('BASIC returns zeroed status', async () => {
    mockTier = 'BASIC';
    const enforcer = new SocialChannelQuotaEnforcer();
    const status = await enforcer.getQuotaStatus('user-1');
    expect(status).toEqual({ used: 0, limit: 0, percent: 0, warning: false });
  });

  it('MASTER returns zeroed percent (no limit)', async () => {
    mockTier = 'MASTER';
    const enforcer = new SocialChannelQuotaEnforcer();
    const status = await enforcer.getQuotaStatus('user-1');
    expect(status.percent).toBe(0);
    expect(status.warning).toBe(false);
  });
});

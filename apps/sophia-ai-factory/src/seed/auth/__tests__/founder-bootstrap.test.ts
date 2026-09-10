import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bootstrapFounderIfConfigured } from '@/seed/auth/founder-bootstrap';
import { getD1 } from '@/seed/db/client';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockGetD1 = vi.mocked(getD1);

describe('founder-bootstrap', () => {
  const originalEnv = process.env.FOUNDER_EMAIL;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.FOUNDER_EMAIL = originalEnv;
  });

  it('returns false when FOUNDER_BOOTSTRAP_ENABLED is false', async () => {
    process.env.FOUNDER_BOOTSTRAP_ENABLED = 'false';
    process.env.FOUNDER_EMAIL = 'founder@agencyos.network';
    const result = await bootstrapFounderIfConfigured({
      id: 'usr_1',
      email: 'founder@agencyos.network',
    });
    expect(result).toBe(false);
    expect(mockGetD1).not.toHaveBeenCalled();
    delete process.env.FOUNDER_BOOTSTRAP_ENABLED;
  });

  it('returns false when FOUNDER_EMAIL is not set', async () => {
    delete process.env.FOUNDER_EMAIL;
    const result = await bootstrapFounderIfConfigured({
      id: 'usr_1',
      email: 'founder@agencyos.network',
    });
    expect(result).toBe(false);
    expect(mockGetD1).not.toHaveBeenCalled();
  });

  it('returns false when user email or id is missing', async () => {
    process.env.FOUNDER_EMAIL = 'founder@agencyos.network';
    expect(await bootstrapFounderIfConfigured({ id: '', email: 'founder@agencyos.network' })).toBe(false);
    expect(await bootstrapFounderIfConfigured({ id: 'usr_1', email: '' })).toBe(false);
  });

  it('returns false when user email does not match FOUNDER_EMAIL', async () => {
    process.env.FOUNDER_EMAIL = 'founder@agencyos.network';
    const result = await bootstrapFounderIfConfigured({
      id: 'usr_2',
      email: 'regular_user@gmail.com',
    });
    expect(result).toBe(false);
    expect(mockGetD1).not.toHaveBeenCalled();
  });

  it('handles comma-separated emails with extra spaces and mixed casing', async () => {
    process.env.FOUNDER_EMAIL = '  Admin@Domain.com , founder@agencyos.network  , OTHER@corp.io ';

    const mockRun = vi.fn().mockResolvedValue({ success: true });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockBatch = vi.fn().mockResolvedValue([]);

    mockGetD1.mockResolvedValue({
      prepare: mockPrepare,
      batch: mockBatch,
    } as unknown as Awaited<ReturnType<typeof getD1>>);

    const result = await bootstrapFounderIfConfigured({
      id: 'usr_founder',
      email: 'FOUNDER@AgencyOS.Network',
      emailVerified: true,
    });

    expect(result).toBe(true);
    expect(mockBatch).toHaveBeenCalledOnce();
    expect(mockPrepare).toHaveBeenCalledTimes(4);
    expect(mockPrepare).toHaveBeenCalledWith('UPDATE "user" SET role = \'admin\' WHERE id = ?1');
    expect(mockPrepare).toHaveBeenCalledWith(
      'UPDATE user_profiles SET role = \'admin\', subscription_tier = \'MASTER\' WHERE user_id = ?1'
    );
    expect(mockPrepare).toHaveBeenCalledWith(
      'UPDATE subscriptions SET tier = \'MASTER\', plan = \'master\' WHERE user_id = ?1'
    );
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_audit_log')
    );
  });

  it('falls back to sequential .run() if db.batch is not present', async () => {
    process.env.FOUNDER_EMAIL = 'founder@agencyos.network';

    const mockRun = vi.fn().mockResolvedValue({ success: true });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

    mockGetD1.mockResolvedValue({
      prepare: mockPrepare,
    } as unknown as Awaited<ReturnType<typeof getD1>>);

    const result = await bootstrapFounderIfConfigured({
      id: 'usr_founder_2',
      email: 'founder@agencyos.network',
      emailVerified: true,
    });

    expect(result).toBe(true);
    expect(mockRun).toHaveBeenCalledTimes(4);
  });

  it('fails safely and returns false without throwing if getD1 returns null', async () => {
    process.env.FOUNDER_EMAIL = 'founder@agencyos.network';
    mockGetD1.mockResolvedValue(null);

    const result = await bootstrapFounderIfConfigured({
      id: 'usr_founder_3',
      email: 'founder@agencyos.network',
      emailVerified: true,
    });

    expect(result).toBe(false);
  });

  it('fails safely and returns false without throwing if D1 operation throws', async () => {
    process.env.FOUNDER_EMAIL = 'founder@agencyos.network';

    mockGetD1.mockResolvedValue({
      prepare: vi.fn().mockImplementation(() => {
        throw new Error('D1 connection timeout');
      }),
    } as unknown as Awaited<ReturnType<typeof getD1>>);

    const result = await bootstrapFounderIfConfigured({
      id: 'usr_founder_4',
      email: 'founder@agencyos.network',
      emailVerified: true,
    });

    expect(result).toBe(false);
  });

  it('rejects promotion when founder email is unverified (fail-closed anti-spoofing)', async () => {
    process.env.FOUNDER_EMAIL = 'founder@agencyos.network';

    const mockRun = vi.fn().mockResolvedValue({ success: true });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockBatch = vi.fn().mockResolvedValue([]);

    mockGetD1.mockResolvedValue({
      prepare: mockPrepare,
      batch: mockBatch,
    } as unknown as Awaited<ReturnType<typeof getD1>>);

    // Attacker attempts to register with founder email but without verifying email
    const result = await bootstrapFounderIfConfigured({
      id: 'usr_attacker_spoof',
      email: 'founder@agencyos.network',
      emailVerified: false,
    });

    expect(result).toBe(false);
    expect(mockBatch).not.toHaveBeenCalled();
    expect(mockPrepare).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE "user" SET role = \'admin\''));
  });

  it('allows promotion when user email is verified in database', async () => {
    process.env.FOUNDER_EMAIL = 'founder@agencyos.network';

    const mockRun = vi.fn().mockResolvedValue({ success: true });
    const mockFirst = vi.fn().mockResolvedValue({ emailVerified: 1 });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun, first: mockFirst });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockBatch = vi.fn().mockResolvedValue([]);

    mockGetD1.mockResolvedValue({
      prepare: mockPrepare,
      batch: mockBatch,
    } as unknown as Awaited<ReturnType<typeof getD1>>);

    // emailVerified not passed directly on user object, but DB says verified
    const result = await bootstrapFounderIfConfigured({
      id: 'usr_verified_in_db',
      email: 'founder@agencyos.network',
    });

    expect(result).toBe(true);
    expect(mockBatch).toHaveBeenCalledOnce();
  });
});

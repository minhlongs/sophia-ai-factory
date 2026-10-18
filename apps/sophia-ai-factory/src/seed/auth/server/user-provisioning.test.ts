import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logger: { error: vi.fn(), info: vi.fn() },
  createServerClient: vi.fn(),
  grantSignupBonusCredits: vi.fn(),
  bootstrapFounderIfConfigured: vi.fn(),
  sendSeedEmail: vi.fn(),
  buildWelcomeHtml: vi.fn((name: string) => `<p>Welcome ${name}</p>`),
}));

vi.mock('@/seed/utils/logger-utility', () => ({ logger: mocks.logger }));
vi.mock('@/seed/utils/to-error', () => ({
  toError: (error: unknown) => error instanceof Error ? error : new Error(String(error)),
}));
vi.mock('@/seed/db/client', () => ({ createServerClient: mocks.createServerClient }));
vi.mock('@/seed/auth/signup-bonus', () => ({ grantSignupBonusCredits: mocks.grantSignupBonusCredits }));
vi.mock('@/seed/auth/founder-bootstrap', () => ({ bootstrapFounderIfConfigured: mocks.bootstrapFounderIfConfigured }));
vi.mock('@/seed/email/email-sender', () => ({ sendSeedEmail: mocks.sendSeedEmail }));
vi.mock('./plugin-configs', () => ({ buildWelcomeHtml: mocks.buildWelcomeHtml }));

import {
  handleUserCreateBefore,
  provisionNewUser,
  sanitizeAndResolveUserName,
} from './user-provisioning';

function makeDb(insert: (table: string, row: unknown) => Promise<unknown>) {
  return {
    from: vi.fn((table: string) => ({
      insert: vi.fn((row: unknown) => insert(table, row)),
    })),
  };
}

describe('user provisioning helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.grantSignupBonusCredits.mockResolvedValue(undefined);
    mocks.bootstrapFounderIfConfigured.mockResolvedValue(undefined);
    mocks.sendSeedEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sanitizes provided names and uses safe email or generic fallbacks', () => {
    expect(sanitizeAndResolveUserName('  Jo\u0000hn\u001f Doe  ', 'jdoe@example.com')).toBe('John Doe');
    expect(sanitizeAndResolveUserName(undefined, '  jane\u0000smith@example.com ')).toBe('janesmith');
    expect(sanitizeAndResolveUserName(42, '   ')).toBe('user');
    expect(sanitizeAndResolveUserName('A'.repeat(130), undefined)).toBe('A'.repeat(100));
  });

  it('returns the original user fields with a resolved name in the create hook', async () => {
    const user = { id: 'user-1', email: 'first.last@example.com', name: '' };

    await expect(handleUserCreateBefore(user)).resolves.toEqual({
      data: { ...user, name: 'first.last' },
    });
  });

  it('creates default organization records, grants signup credits, and bootstraps verified users', async () => {
    const inserted: Array<{ table: string; row: unknown }> = [];
    const db = makeDb(async (table, row) => {
      inserted.push({ table, row });
      return { success: true };
    });
    mocks.createServerClient.mockReturnValue(db);

    const verifiedUser: Parameters<typeof provisionNewUser>[0] & { emailVerified: boolean } = {
      id: 'user-2', name: 'Verified User', email: 'hello+tag@example.com', emailVerified: true,
    };
    await provisionNewUser(verifiedUser);

    expect(inserted.map((entry) => entry.table)).toEqual([
      'organizations', 'org_members', 'org_balances', 'subscriptions', 'user_profiles',
    ]);
    expect(inserted[0].row).toEqual(expect.objectContaining({ name: 'Verified User', slug: expect.stringMatching(/^hello-tag-/) }));
    expect(inserted[1].row).toEqual(expect.objectContaining({ user_id: 'user-2', role: 'owner' }));
    expect(inserted[2].row).toEqual(expect.objectContaining({ balance: 50 }));
    expect(inserted[3].row).toEqual(expect.objectContaining({ user_id: 'user-2', plan: 'basic', tier: 'BASIC', status: 'active' }));
    expect(inserted[4].row).toEqual(expect.objectContaining({ user_id: 'user-2', display_name: 'Verified User' }));
    expect(mocks.grantSignupBonusCredits).toHaveBeenCalledWith('user-2', 50);
    expect(mocks.bootstrapFounderIfConfigured).toHaveBeenCalledTimes(1);
    expect(mocks.sendSeedEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'hello+tag@example.com', subject: 'Welcome to Sophia AI Factory!', html: '<p>Welcome Verified User</p>',
    }));
  });

  it('defers founder bootstrap for unverified users while still provisioning and welcoming them', async () => {
    mocks.createServerClient.mockReturnValue(makeDb(async () => ({ success: true })));

    const unverifiedUser: Parameters<typeof provisionNewUser>[0] & { emailVerified: boolean } = {
      id: 'user-3', email: 'new@example.com', emailVerified: false,
    };
    await provisionNewUser(unverifiedUser);

    expect(mocks.grantSignupBonusCredits).toHaveBeenCalledWith('user-3', 50);
    expect(mocks.bootstrapFounderIfConfigured).not.toHaveBeenCalled();
    expect(mocks.logger.info).toHaveBeenCalledWith(
      '[databaseHook] Founder bootstrap deferred: email not verified',
      undefined,
      expect.objectContaining({ userId: 'user-3' }),
    );
    expect(mocks.sendSeedEmail).toHaveBeenCalledTimes(1);
  });

  it('retries organization creation and logs when the fallback insert also fails', async () => {
    vi.useFakeTimers();
    const db = makeDb(async (table) => {
      if (table === 'organizations') throw new Error('organization write failed');
      return { success: true };
    });
    mocks.createServerClient.mockReturnValue(db);
    const pending = provisionNewUser({ id: 'user-4', name: 'Retry User' });

    await vi.runAllTimersAsync();
    await pending;

    expect(db.from).toHaveBeenCalledTimes(4);
    expect(mocks.logger.error).toHaveBeenCalledWith(
      '[databaseHook] org creation fallback failed',
      expect.objectContaining({ message: 'organization write failed' }),
    );
    expect(mocks.grantSignupBonusCredits).toHaveBeenCalledWith('user-4', 50);
  });

  it('logs a missing database binding and still sends the welcome email', async () => {
    mocks.createServerClient.mockReturnValue(null);

    await provisionNewUser({ id: 'user-5', name: 'No DB', email: 'nodb@example.com' });

    expect(mocks.logger.error).toHaveBeenCalledWith(
      '[databaseHook] org creation failed',
      expect.objectContaining({ message: 'D1 database binding not available' }),
    );
    expect(mocks.grantSignupBonusCredits).not.toHaveBeenCalled();
    expect(mocks.sendSeedEmail).toHaveBeenCalledTimes(1);
  });
});

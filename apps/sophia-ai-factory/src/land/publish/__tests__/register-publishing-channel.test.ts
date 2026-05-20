/**
 * Unit tests for registerPublishingChannel — validator guards,
 * idempotent re-register, and successful new insertion.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFirst, mockRun, mockBind, mockPrepare, mockGetD1Raw } = vi.hoisted(() => {
  const first = vi.fn();
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn(() => ({ first, run }));
  const prepare = vi.fn(() => ({ bind }));
  const getD1Raw = vi.fn().mockResolvedValue({ prepare });
  return { mockFirst: first, mockRun: run, mockBind: bind, mockPrepare: prepare, mockGetD1Raw: getD1Raw };
});

vi.mock('@/seed/db/client', () => ({
  getD1Raw: mockGetD1Raw,
}));

import {
  registerPublishingChannel,
  validateRegisterInput,
  RegisterChannelError,
} from '@/land/publish/register-publishing-channel';

describe('validateRegisterInput', () => {
  it('rejects unsupported provider', () => {
    expect(() =>
      validateRegisterInput({
        userId: 'u1',
        provider: 'unknown' as unknown as 'tiktok',
        externalAccountId: 'a1',
        accessToken: 't1',
      }),
    ).toThrow(RegisterChannelError);
  });
  it('rejects missing accessToken', () => {
    expect(() =>
      validateRegisterInput({
        userId: 'u1',
        provider: 'tiktok',
        externalAccountId: 'a1',
        accessToken: '',
      }),
    ).toThrow(/required/);
  });
  it('accepts all supported providers', () => {
    const providers = ['tiktok', 'instagram', 'facebook', 'twitter', 'pinterest', 'linkedin', 'threads'] as const;
    for (const p of providers) {
      expect(() =>
        validateRegisterInput({ userId: 'u1', provider: p, externalAccountId: 'a1', accessToken: 't' }),
      ).not.toThrow();
    }
  });
});

describe('registerPublishingChannel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetD1Raw.mockResolvedValue({ prepare: mockPrepare });
    mockBind.mockImplementation(() => ({ first: mockFirst, run: mockRun }));
    mockPrepare.mockImplementation(() => ({ bind: mockBind }));
    mockRun.mockResolvedValue({ success: true });
  });

  it('inserts new channel when none exists', async () => {
    mockFirst.mockResolvedValueOnce(null); // lookup
    const out = await registerPublishingChannel({
      userId: 'u1',
      provider: 'tiktok',
      externalAccountId: 'tt_acct_42',
      accessToken: 'tok',
      displayName: '@me',
    });
    expect(out.alreadyExisted).toBe(false);
    expect(out.channelId).toMatch(/^[0-9a-f]{32}$/);
    expect(out.provider).toBe('tiktok');
  });

  it('returns existing channelId on re-register (idempotent)', async () => {
    mockFirst.mockResolvedValueOnce({ id: 'existing-id-1234' });
    const out = await registerPublishingChannel({
      userId: 'u1',
      provider: 'instagram',
      externalAccountId: 'ig_42',
      accessToken: 'new-tok',
    });
    expect(out.alreadyExisted).toBe(true);
    expect(out.channelId).toBe('existing-id-1234');
  });
});

/**
 * Unit tests for isUserInDunning with cache-busting flag.
 * Risk #8 Hardening Verification.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isUserInDunning } from '../check-user-dunning';

describe('isUserInDunning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false for invalid or empty userId', async () => {
    expect(await isUserInDunning('')).toBe(false);
    expect(await isUserInDunning('   ')).toBe(false);
    expect(await isUserInDunning(null as unknown as string)).toBe(false);
  });

  it('fast-paths and returns false when bypassDunningCache is true', async () => {
    const mockDb = {
      prepare: vi.fn(),
    };
    const result = await isUserInDunning('user_123', {
      bypassDunningCache: true,
      db: mockDb as never,
    });
    expect(result).toBe(false);
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('returns false when no dunning row exists', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      }),
    };
    const result = await isUserInDunning('user_clean', { db: mockDb as never });
    expect(result).toBe(false);
  });

  it('returns false when dunning_state is current', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ dunning_state: 'current' }),
        }),
      }),
    };
    const result = await isUserInDunning('user_current', { db: mockDb as never });
    expect(result).toBe(false);
  });

  it('returns true when dunning_state is past_due or delinquent', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ dunning_state: 'past_due' }),
        }),
      }),
    };
    const result = await isUserInDunning('user_past_due', { db: mockDb as never });
    expect(result).toBe(true);
  });

  it('bypasses past_due lock when bypassDunningCache is explicitly passed', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ dunning_state: 'past_due' }),
        }),
      }),
    };
    const result = await isUserInDunning('user_checkout_return', {
      bypassDunningCache: true,
      db: mockDb as never,
    });
    expect(result).toBe(false);
  });

  it('handles database exceptions gracefully and returns false without throwing', async () => {
    const mockDb = {
      prepare: vi.fn().mockImplementation(() => {
        throw new Error('D1 connection timeout');
      }),
    };

    const result = await isUserInDunning('user_error', { db: mockDb as never });
    expect(result).toBe(false);
  });
});

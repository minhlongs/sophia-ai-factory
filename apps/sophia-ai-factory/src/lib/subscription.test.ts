import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserTier, checkTierAccess, isTierHigherOrEqual } from './subscription';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('Subscription Library', () => {
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockSingle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Supabase query chain mock
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    // @ts-expect-error - Mock only implements subset of SupabaseClient interface
    vi.mocked(createClient).mockReturnValue({
      from: mockFrom,
    });
  });

  describe('isTierHigherOrEqual', () => {
    it('should return true when current tier is higher', () => {
      expect(isTierHigherOrEqual('ENTERPRISE', 'BASIC')).toBe(true);
      expect(isTierHigherOrEqual('PREMIUM', 'BASIC')).toBe(true);
      expect(isTierHigherOrEqual('ENTERPRISE', 'PREMIUM')).toBe(true);
    });

    it('should return true when current tier is equal', () => {
      expect(isTierHigherOrEqual('BASIC', 'BASIC')).toBe(true);
      expect(isTierHigherOrEqual('PREMIUM', 'PREMIUM')).toBe(true);
      expect(isTierHigherOrEqual('ENTERPRISE', 'ENTERPRISE')).toBe(true);
    });

    it('should return false when current tier is lower', () => {
      expect(isTierHigherOrEqual('BASIC', 'PREMIUM')).toBe(false);
      expect(isTierHigherOrEqual('BASIC', 'ENTERPRISE')).toBe(false);
      expect(isTierHigherOrEqual('PREMIUM', 'ENTERPRISE')).toBe(false);
    });
  });

  describe('getUserTier', () => {
    it('should return BASIC if error occurs', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'Error' } });
      const tier = await getUserTier('user-123');
      expect(tier).toBe('BASIC');
    });

    it('should return BASIC if no data returned', async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });
      const tier = await getUserTier('user-123');
      expect(tier).toBe('BASIC');
    });

    it('should return mapped tier for valid db value', async () => {
      mockSingle.mockResolvedValue({ data: { subscription_tier: 'premium' }, error: null });
      const tier = await getUserTier('user-123');
      expect(tier).toBe('PREMIUM');
    });

    it('should return BASIC for unknown db value', async () => {
      mockSingle.mockResolvedValue({ data: { subscription_tier: 'unknown_tier' }, error: null });
      const tier = await getUserTier('user-123');
      expect(tier).toBe('BASIC');
    });

    it('should handle legacy "pro" tier as PREMIUM', async () => {
      mockSingle.mockResolvedValue({ data: { subscription_tier: 'pro' }, error: null });
      const tier = await getUserTier('user-123');
      expect(tier).toBe('PREMIUM');
    });
  });

  describe('checkTierAccess', () => {
    it('should return true if user meets requirement', async () => {
      mockSingle.mockResolvedValue({ data: { subscription_tier: 'premium' }, error: null });
      const hasAccess = await checkTierAccess('user-123', 'BASIC');
      expect(hasAccess).toBe(true);
    });

    it('should return false if user does not meet requirement', async () => {
      mockSingle.mockResolvedValue({ data: { subscription_tier: 'basic' }, error: null });
      const hasAccess = await checkTierAccess('user-123', 'PREMIUM');
      expect(hasAccess).toBe(false);
    });
  });
});

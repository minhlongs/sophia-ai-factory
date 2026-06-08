import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tierGuard } from './tier-guard';
import * as getUserTierLib from '@/seed/db/resolve-user-tier';

vi.mock('@/seed/db/resolve-user-tier');

describe('tierGuard', () => {
  const userId = 'user-123';
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkMultiChannelAccess', () => {
    it('should deny BASIC users', async () => {
      vi.mocked(getUserTierLib.resolveUserTier).mockResolvedValue('BASIC');
      const result = await tierGuard.checkMultiChannelAccess(userId);
      expect(result).toBe(false);
    });
    it('should allow PREMIUM users', async () => {
      vi.mocked(getUserTierLib.resolveUserTier).mockResolvedValue('PREMIUM');
      const result = await tierGuard.checkMultiChannelAccess(userId);
      expect(result).toBe(true);
    });
  });

  describe('checkLimit', () => {
    it('should allow BASIC users within limit (currentUsage=0)', async () => {
      vi.mocked(getUserTierLib.resolveUserTier).mockResolvedValue('BASIC');
      const result = await tierGuard.checkLimit(userId, 'videoTemplates');
      expect(result.allowed).toBe(true);
      expect(result.requiredTier).toBe('PREMIUM');
    });
    it('should allow PREMIUM users', async () => {
      vi.mocked(getUserTierLib.resolveUserTier).mockResolvedValue('PREMIUM');
      const result = await tierGuard.checkLimit(userId, 'videoTemplates');
      expect(result.allowed).toBe(true);
    });
    it('should always allow MASTER users', async () => {
      vi.mocked(getUserTierLib.resolveUserTier).mockResolvedValue('MASTER');
      const result = await tierGuard.checkLimit(userId, 'videoTemplates');
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(Infinity);
    });
  });
});

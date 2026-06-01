import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tierGuard } from './tier-guard';
import * as getUserTierLib from '@/seed/db/get-user-tier';
import { templateService } from './services/template-service';

vi.mock('@/seed/db/get-user-tier');
vi.mock('./services/template-service');

describe('tierGuard', () => {
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkMultiChannelAccess', () => {
    it('should deny BASIC users', async () => {
      vi.mocked(getUserTierLib.getUserTier).mockResolvedValue('BASIC');
      const result = await tierGuard.checkMultiChannelAccess(userId);
      expect(result).toBe(false);
    });

    it('should allow PREMIUM users', async () => {
      vi.mocked(getUserTierLib.getUserTier).mockResolvedValue('PREMIUM');
      const result = await tierGuard.checkMultiChannelAccess(userId);
      expect(result).toBe(true);
    });

    it('should allow ENTERPRISE users', async () => {
      vi.mocked(getUserTierLib.getUserTier).mockResolvedValue('ENTERPRISE');
      const result = await tierGuard.checkMultiChannelAccess(userId);
      expect(result).toBe(true);
    });
  });

  describe('checkLimit - videoTemplates', () => {
    it('should allow BASIC users within limit (limit 5)', async () => {
      vi.mocked(getUserTierLib.getUserTier).mockResolvedValue('BASIC');
      vi.mocked(templateService.getTemplates).mockResolvedValue([]); // Usage 0

      const result = await tierGuard.checkLimit(userId, 'videoTemplates');
      expect(result.allowed).toBe(true);
    });

    it('should deny BASIC users exceeding limit', async () => {
      vi.mocked(getUserTierLib.getUserTier).mockResolvedValue('BASIC');
      // Simulate 6 templates (limit 5)
      vi.mocked(templateService.getTemplates).mockResolvedValue(Array(6).fill({ is_predefined: false }));

      const result = await tierGuard.checkLimit(userId, 'videoTemplates');
      expect(result.allowed).toBe(false);
      expect(result.requiredTier).toBe('PREMIUM');
    });

    it('should allow PREMIUM users (limit 999)', async () => {
        vi.mocked(getUserTierLib.getUserTier).mockResolvedValue('PREMIUM');
        vi.mocked(templateService.getTemplates).mockResolvedValue(Array(10).fill({ is_predefined: false }));

        const result = await tierGuard.checkLimit(userId, 'videoTemplates');
        expect(result.allowed).toBe(true);
    });

    it('should allow ENTERPRISE users (limit 999)', async () => {
        vi.mocked(getUserTierLib.getUserTier).mockResolvedValue('ENTERPRISE');
        vi.mocked(templateService.getTemplates).mockResolvedValue(Array(5).fill({ is_predefined: false }));

        const result = await tierGuard.checkLimit(userId, 'videoTemplates');
        expect(result.allowed).toBe(true);
    });
  });
});

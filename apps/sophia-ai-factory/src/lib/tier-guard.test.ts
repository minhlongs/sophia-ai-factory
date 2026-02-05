import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tierGuard } from './tier-guard';
import * as subscriptionLib from './subscription';
import { templateService } from './services/template-service';

vi.mock('./subscription');
vi.mock('./services/template-service');

describe('tierGuard', () => {
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkMultiChannelAccess', () => {
    it('should deny BASIC users', async () => {
      vi.mocked(subscriptionLib.getUserTier).mockResolvedValue('BASIC');
      const result = await tierGuard.checkMultiChannelAccess(userId);
      expect(result).toBe(false);
    });

    it('should allow PREMIUM users', async () => {
      vi.mocked(subscriptionLib.getUserTier).mockResolvedValue('PREMIUM');
      const result = await tierGuard.checkMultiChannelAccess(userId);
      expect(result).toBe(true);
    });

    it('should allow ENTERPRISE users', async () => {
      vi.mocked(subscriptionLib.getUserTier).mockResolvedValue('ENTERPRISE');
      const result = await tierGuard.checkMultiChannelAccess(userId);
      expect(result).toBe(true);
    });
  });

  describe('checkLimit - videoTemplates', () => {
    it('should deny BASIC users (limit 0 custom templates)', async () => {
      vi.mocked(subscriptionLib.getUserTier).mockResolvedValue('BASIC');
      vi.mocked(templateService.getTemplates).mockResolvedValue([]);

      const result = await tierGuard.checkLimit(userId, 'videoTemplates');
      expect(result.allowed).toBe(false);
      expect(result.requiredTier).toBe('ENTERPRISE');
    });

    it('should deny PREMIUM users (limit 0 custom templates)', async () => {
        vi.mocked(subscriptionLib.getUserTier).mockResolvedValue('PREMIUM');
        vi.mocked(templateService.getTemplates).mockResolvedValue([]);

        const result = await tierGuard.checkLimit(userId, 'videoTemplates');
        expect(result.allowed).toBe(false);
        expect(result.requiredTier).toBe('ENTERPRISE');
    });

    it('should allow ENTERPRISE users (limit 999)', async () => {
        vi.mocked(subscriptionLib.getUserTier).mockResolvedValue('ENTERPRISE');
        vi.mocked(templateService.getTemplates).mockResolvedValue(Array(5).fill({ is_predefined: false }));

        const result = await tierGuard.checkLimit(userId, 'videoTemplates');
        expect(result.allowed).toBe(true);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as BudgetGuard from '../token-budget-guard';
import { tokenCounter } from '../token-counter';
import { logger } from '@/seed/utils/logger-utility';

vi.mock('../token-counter', () => ({
  tokenCounter: {
    estimateTokens: vi.fn(),
  },
}));


vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TokenBudgetGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('estimateTokens', () => {
    it('should call tokenCounter.estimateTokens', () => {
      (tokenCounter.estimateTokens as any).mockReturnValue({ tokens: 10 });
      expect(BudgetGuard.estimateTokens('test')).toBe(10);
      expect(tokenCounter.estimateTokens).toHaveBeenCalledWith('test');
    });
  });

  describe('checkBudget', () => {
    it('should return safe: true when under budget', () => {
      const result = BudgetGuard.checkBudget(10000, 100000, 20000);
      // limit = 100k, buffer = 20k -> effective = 80k. 10k < 80k.
      expect(result.safe).toBe(true);
      expect(result.tokensRemaining).toBe(70000);
    });

    it('should return safe: false when over budget', () => {
      const result = BudgetGuard.checkBudget(90000, 100000, 20000);
      // 90k > 80k.
      expect(result.safe).toBe(false);
      expect(result.tokensRemaining).toBe(-10000);
    });
  });

  describe('enforceHardCeiling', () => {
    it('should not throw if under ceiling', () => {
      expect(() => BudgetGuard.enforceHardCeiling(1000, 2000)).not.toThrow();
    });

    it('should throw and log error if over ceiling', () => {
      expect(() => BudgetGuard.enforceHardCeiling(3000, 2000)).toThrow(/Hard ceiling exceeded/);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('trimToBudget', () => {
    const mockMessages = [
      { role: 'system', content: 'System Prompt' },
      { role: 'user', content: 'Msg 1' },
      { role: 'assistant', content: 'Ans 1' },
      { role: 'user', content: 'Msg 2' },
      { role: 'assistant', content: 'Ans 2' },
    ] as any;

    it('should return empty array for empty input', () => {
      expect(BudgetGuard.trimToBudget([], 1000)).toEqual([]);
    });

    it('should preserve system message and trim oldest user/assistant messages', () => {
      // Mock durations: system = 100, others = 100 each.
      // Total = 500. If budget = 300, should keep system (100) and last 2 (200).
      (tokenCounter.estimateTokens as any).mockImplementation((content: string) => ({
        tokens: 100,
      }));

      const result = BudgetGuard.trimToBudget(mockMessages, 300);

      expect(result[0].role).toBe('system');
    // Budget 300: system(100+4) + msgs(104ea). system+Ans2=208<300, +Msg2=312>300 -> 2 items
    expect(result).toHaveLength(2);
    expect(result).toHaveLength(2); // 300 budget keeps system + last msg
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Conversation trimmed'), undefined, expect.any(Object));
    });

    it('should return all messages if they fit in budget', () => {
      (tokenCounter.estimateTokens as any).mockReturnValue({ tokens: 10 });
      const result = BudgetGuard.trimToBudget(mockMessages, 1000);
      expect(result).toHaveLength(mockMessages.length);
    });

    it('should handle absence of system message', () => {
      const noSystem = mockMessages.slice(1);
      (tokenCounter.estimateTokens as any).mockReturnValue({ tokens: 100 });
      // Budget 208: msg(100+4) + msg(100+4) = 208.
      const result = BudgetGuard.trimToBudget(noSystem, 208);
    expect(result).toHaveLength(2); // budget 200 keeps 2 msgs
      expect(result[0].role).not.toBe('system');
    });
  });

  describe('compressConversation', () => {
    it('should return messages unchanged (placeholder behavior)', () => {
      const msgs = [{ role: 'user', content: 'test' } as any];
      const result = BudgetGuard.compressConversation(msgs);
      expect(result).toEqual(msgs);
      expect(logger.info).toHaveBeenCalledWith(
      "[TokenBudgetGuard] compressConversation called (placeholder for summarizer integration)"
    );
    });
  });
});

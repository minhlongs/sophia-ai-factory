import { describe, it, expect } from 'vitest';
import { ContextBudgetEnforcer } from '../context-budget-enforcer';
import { Turn } from '../context-state-manager';

describe('ContextBudgetEnforcer', () => {
  describe('estimateTokens', () => {
    it('should return 0 for empty text', () => {
      expect(ContextBudgetEnforcer.estimateTokens('')).toBe(0);
      expect(ContextBudgetEnforcer.estimateTokens(null as any)).toBe(0);
    });

    it('should estimate tokens based on length/4 heuristic', () => {
      // 40 chars should be 10 tokens
      expect(ContextBudgetEnforcer.estimateTokens('a'.repeat(40))).toBe(10);
      // 41 chars should be 11 tokens (ceil)
      expect(ContextBudgetEnforcer.estimateTokens('a'.repeat(41))).toBe(11);
    });
  });

  describe('checkBudget', () => {
    it('should return ok for tokens below warning threshold', () => {
      expect(ContextBudgetEnforcer.checkBudget(0).status).toBe('ok');
      expect(ContextBudgetEnforcer.checkBudget(199_999).status).toBe('ok');
    });

    it('should return warning at WARNING_THRESHOLD', () => {
      expect(ContextBudgetEnforcer.checkBudget(200_000).status).toBe('warning');
      expect(ContextBudgetEnforcer.checkBudget(229_999).status).toBe('warning');
    });

    it('should return critical at CRITICAL_THRESHOLD', () => {
      expect(ContextBudgetEnforcer.checkBudget(230_000).status).toBe('critical');
      expect(ContextBudgetEnforcer.checkBudget(239_999).status).toBe('critical');
    });

    it('should return overflow at HARD_CEILING', () => {
      expect(ContextBudgetEnforcer.checkBudget(240_000).status).toBe('overflow');
      expect(ContextBudgetEnforcer.checkBudget(250_000).status).toBe('overflow');
    });
  });

  describe('trimHistory', () => {
    it('should return all turns if length is <= maxTurns', () => {
      const turns: Turn[] = [
        { role: 'user', content: 'hi', timestamp: 1 },
        { role: 'assistant', content: 'hello', timestamp: 2 },
      ];
      expect(ContextBudgetEnforcer.trimHistory(turns, 3)).toHaveLength(2);
      expect(ContextBudgetEnforcer.trimHistory(turns, 3)).toEqual(turns);
    });

    it('should return only the last maxTurns', () => {
      const turns: Turn[] = Array.from({ length: 10 }, (_, i) => ({
        role: 'user',
        content: `msg ${i}`,
        timestamp: i,
      }));
      const trimmed = ContextBudgetEnforcer.trimHistory(turns, 3);
      expect(trimmed).toHaveLength(3);
      expect(trimmed[0].content).toBe('msg 7');
      expect(trimmed[1].content).toBe('msg 8');
      expect(trimmed[2].content).toBe('msg 9');
    });

    it('should return empty array for empty input', () => {
      expect(ContextBudgetEnforcer.trimHistory([], 3)).toEqual([]);
    });
  });

  describe('compressToSummary', () => {
    it('should return "No history yet." for empty history', () => {
      expect(ContextBudgetEnforcer.compressToSummary([])).toBe('No history yet.');
    });

    it('should summarize a single turn', () => {
      const turns: Turn[] = [{ role: 'user', content: 'Hello world', timestamp: 1 }];
      const summary = ContextBudgetEnforcer.compressToSummary(turns);
      expect(summary).toContain('[Turn 1 - user]: Hello world');
    });

    it('should truncate very long single messages to 100 chars', () => {
      const longContent = 'a'.repeat(1000);
      const turns: Turn[] = [{ role: 'assistant', content: longContent, timestamp: 1 }];
      const summary = ContextBudgetEnforcer.compressToSummary(turns);

      // Expected: [Turn 1 - assistant]: a... (100 'a's + ...)
      const expectedSnippet = 'a'.repeat(100) + '...';
      expect(summary).toContain(expectedSnippet);
      expect(summary.length).toBeLessThan(200);
    });

    it('should handle 1000+ turns without crashing', () => {
      const turns: Turn[] = Array.from({ length: 1000 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`,
        timestamp: i,
      }));
      const summary = ContextBudgetEnforcer.compressToSummary(turns);
      expect(summary).toContain('[Turn 1000 - user]');
      expect(summary.length).toBeGreaterThan(1000 * 10); // Basic check that they are all there
    });

    it('should significantly reduce tokens for large conversation history (Stress Test)', () => {
      // Goal: Verify that compressing 250K tokens actually REDUCES tokens.
      // 250K tokens ~ 1M characters.
      // We simulate this with 100 turns, each ~ 10K characters.
      const turnCount = 100;
      const contentSize = 10_000;
      const turns: Turn[] = Array.from({ length: turnCount }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'b'.repeat(contentSize),
        timestamp: Date.now() + i,
      }));

      const inputTokens = ContextBudgetEnforcer.estimateTokens(
        turns.map(t => t.content).join(' ')
      );

      const summary = ContextBudgetEnforcer.compressToSummary(turns);
      const outputTokens = ContextBudgetEnforcer.estimateTokens(summary);

      // Verifications
      // 1. Output < 30% of input
      const ratio = outputTokens / inputTokens;
      expect(ratio).toBeLessThan(0.3);

      // 2. Output < 70K tokens (safe limit)
      expect(outputTokens).toBeLessThan(70_000);

      // Log results for visibility in test logs
      console.log(`Stress Test Results: Input=${inputTokens}, Output=${outputTokens}, Ratio=${ratio.toFixed(4)}`);
    });
  });
});

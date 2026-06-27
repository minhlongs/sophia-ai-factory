/**
 * TokenCounter Tests
 *
 * Validates heuristic token estimation for English, Vietnamese,
 * message arrays, and model-specific limits.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenCounter } from '../token-counter';
import type { ChatMessage } from '../provider-interface';

// Mock the logger to suppress output in tests
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TokenCounter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── English text estimation ───────────────────────────────────────────

  describe('English text estimation', () => {
    it('returns 0 tokens for empty string', () => {
      const counter = new TokenCounter('openai');
      const result = counter.estimateTokens('');
      expect(result.tokens).toBe(0);
      expect(result.characters).toBe(0);
      expect(result.language).toBe('unknown');
    });

    it('estimates tokens for short English text (~4 chars/token)', () => {
      const counter = new TokenCounter('openai');
      // "hello world" = 11 chars / 4 = 2.75 → ceil = 3
      const result = counter.estimateTokens('hello world');
      expect(result.tokens).toBe(3);
      expect(result.characters).toBe(11);
      expect(result.language).toBe('en');
      expect(result.method).toBe('openai');
    });

    it('estimates tokens for longer English text', () => {
      const counter = new TokenCounter('openai');
      const text = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
      const result = counter.estimateTokens(text);
      // Ceiling division: Math.ceil(len / 4)
      expect(result.tokens).toBe(Math.ceil(text.length / 4));
      expect(result.language).toBe('en');
    });

    it('uses ~3.5 chars/token in anthropic mode', () => {
      const counter = new TokenCounter('anthropic');
      const text = 'a'.repeat(100);
      const result = counter.estimateTokens(text);
      // 100 / 3.5 = 28.57 → ceil = 29
      expect(result.tokens).toBe(29);
      expect(result.method).toBe('anthropic');
    });

    it('returns a TokenEstimate with all fields populated', () => {
      const counter = new TokenCounter('openai');
      const result = counter.estimateTokens('test text');
      expect(result).toEqual({
        tokens: expect.any(Number),
        characters: 9,
        language: 'en',
        method: 'openai',
      });
    });
  });

  // ── Vietnamese text estimation ────────────────────────────────────────

  describe('Vietnamese text estimation', () => {
    // "Xin chào các bạn ở đây" has: à, à, ộ = 3 VI chars out of 21 alpha = 0.14
    // Need more: "Xin chào các bạn ơi nhé" has: à, à, ơ, ệ = 4 VI chars out of 20 alpha = 0.20 > 0.15
    it('detects Vietnamese language from sufficient diacritics', () => {
      const counter = new TokenCounter('openai');
      const result = counter.estimateTokens('Xin chào các bạn ơi nhé');
      expect(result.language).toBe('vi');
    });

    it('estimates Vietnamese tokens at ~2.5 chars/token (openai mode)', () => {
      const counter = new TokenCounter('openai');
      // "Xin chào các bạn ơi nhé" = 23 chars
      // Vietnamese: 23 / 2.5 = 9.2 → ceil = 10
      const result = counter.estimateTokens('Xin chào các bạn ơi nhé');
      expect(result.language).toBe('vi');
      expect(result.tokens).toBe(10);
    });

    it('estimates Vietnamese tokens at ~1.8 chars/token (anthropic mode)', () => {
      const counter = new TokenCounter('anthropic');
      const text = 'Xin chào các bạn ơi nhé';
      const result = counter.estimateTokens(text);
      // 23 / 1.8 = 12.78 → ceil = 13
      expect(result.language).toBe('vi');
      expect(result.tokens).toBe(13);
    });

    it('handles mixed English-Vietnamese text with VI majority', () => {
      const counter = new TokenCounter('openai');
      const result = counter.estimateTokens('Xin chào các bạn ơi nhé đây');
      // VI ratio > 0.15 → 'vi'
      expect(result.language).toBe('vi');
    });

    it('handles long Vietnamese text', () => {
      const counter = new TokenCounter('openai');
      const text = 'Tôi cần hỗ trợ xây dựng nền tảng SaaS cho doanh nghiệp của tôi ơi. '.repeat(5);
      const result = counter.estimateTokens(text);
      expect(result.tokens).toBeGreaterThan(0);
      expect(result.language).toBe('vi');
    });
  });

  // ── Message array estimation ──────────────────────────────────────────

  describe('estimateMessages', () => {
    it('returns 0 for an empty message array', () => {
      const counter = new TokenCounter('openai');
      expect(counter.estimateMessages([])).toBe(0);
    });

    it('estimates total tokens for a message array with overhead', () => {
      const counter = new TokenCounter('openai');
  const messages = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
  ] as ChatMessage[];
      // "Hello" = 5/4=2, "Hi there!" = 9/4=3 → 5 content + 8 overhead = 13
      const total = counter.estimateMessages(messages);
      expect(total).toBe(13);
    });

    it('adds 4 overhead tokens per message', () => {
      const counter = new TokenCounter('openai');
      const single = [{ role: 'user', content: 'test' }] as ChatMessage[];
      // "test" = 4/4=1 + 4 overhead = 5
      expect(counter.estimateMessages(single)).toBe(5);
    });

    it('scales linearly with message count', () => {
      const counter = new TokenCounter('openai');
      const single = [{ role: 'user', content: 'hello' }] as ChatMessage[];
      const triple = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hello' },
        { role: 'user', content: 'hello' },
      ];
      // Each "hello" = 5/4=2 + 4 overhead = 5 tokens
      expect(counter.estimateMessages(triple as ChatMessage[])).toBe(
        counter.estimateMessages(single) * 3,
      );
    });

    it('handles messages with Vietnamese content', () => {
      const counter = new TokenCounter('openai');
  const messages = [
    { role: 'user', content: 'Xin chào' },
    { role: 'assistant', content: 'Chào bạn' },
  ] as ChatMessage[];
      const total = counter.estimateMessages(messages);
      expect(total).toBeGreaterThan(0);
    });

    it('handles a large message array', () => {
      const counter = new TokenCounter('openai');
      const messages = Array.from({ length: 100 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i}`,
      }));
      const total = counter.estimateMessages(messages);
      expect(total).toBeGreaterThan(0);
    });
  });

  // ── Model-specific limits ─────────────────────────────────────────────

  describe('model-specific behavior', () => {
    it('accepts a model parameter (logged for observability)', () => {
      const counter = new TokenCounter('openai');
      // Should not throw — model param is used for logging
      const result = counter.estimateTokens('test text', 'gpt-4o');
      expect(result.tokens).toBeGreaterThan(0);
    });

    it('estimates tokens identically regardless of model string', () => {
      const counter = new TokenCounter('openai');
      const text = 'Hello world, this is a test message';
      const withoutModel = counter.estimateTokens(text);
      const withModel = counter.estimateTokens(text, 'claude-sonnet-4-6');
      expect(withModel.tokens).toBe(withoutModel.tokens);
    });

    it('anthropic mode is more conservative than openai mode', () => {
      const text = 'a'.repeat(100);
      const openai = new TokenCounter('openai').estimateTokens(text);
      const anthropic = new TokenCounter('anthropic').estimateTokens(text);
      // Anthropic uses 3.5 chars/token vs OpenAI's 4.0 → more tokens estimated
      expect(anthropic.tokens).toBeGreaterThanOrEqual(openai.tokens);
    });

    it('handles null/undefined model gracefully', () => {
      const counter = new TokenCounter('openai');
      const result = counter.estimateTokens('test', undefined);
      expect(result.tokens).toBeGreaterThan(0);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles single character', () => {
      const counter = new TokenCounter('openai');
      const result = counter.estimateTokens('a');
      expect(result.tokens).toBe(1);
    });

    it('handles text with only numbers', () => {
      const counter = new TokenCounter('openai');
      const result = counter.estimateTokens('1234567890');
      expect(result.tokens).toBeGreaterThan(0);
      // Numbers have no alpha chars → 'unknown' language
      expect(result.language).toBe('unknown');
    });

    it('handles text with only punctuation', () => {
      const counter = new TokenCounter('openai');
      const result = counter.estimateTokens('!!!???...');
      expect(result.tokens).toBeGreaterThan(0);
    });

    it('handles CJK characters', () => {
      const counter = new TokenCounter('openai');
      const result = counter.estimateTokens('你好世界');
      expect(result.tokens).toBeGreaterThan(0);
      expect(result.language).toBe('mixed');
    });

    it('handles very long single-line text', () => {
      const counter = new TokenCounter('openai');
      const text = 'a'.repeat(1_000_000);
      const result = counter.estimateTokens(text);
      expect(result.tokens).toBe(250_000); // 1M / 4
      expect(result.characters).toBe(1_000_000);
    });

    it('handles text with mixed whitespace', () => {
      const counter = new TokenCounter('openai');
      const result = counter.estimateTokens('hello\nworld\tfoo\r\nbar');
      expect(result.tokens).toBeGreaterThan(0);
    });

    it('handles empty string content gracefully', () => {
      const counter = new TokenCounter('openai');
      const result = counter.estimateTokens('');
      expect(result.tokens).toBe(0);
    });
  });

  // ── Singleton convenience ─────────────────────────────────────────────

  describe('tokenCounter singleton', () => {
    it('estimates tokens in openai mode', () => {
      const counter = new TokenCounter('openai');
      const result = counter.estimateTokens('hello');
      expect(result.method).toBe('openai');
      expect(result.tokens).toBeGreaterThan(0);
    });
  });
});

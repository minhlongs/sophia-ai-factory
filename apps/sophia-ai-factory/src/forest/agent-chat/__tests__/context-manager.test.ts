/**
 * ContextManager Tests
 *
 * Validates token-budget enforcement: estimation, limit detection,
 * trimming strategy, and system-prompt preservation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ContextManager,
  DEFAULT_CONTEXT_LIMIT,
  SUMMARIZE_THRESHOLD,
  MIN_RECENT_MESSAGES,
  getContextManager,
  resetContextManager,
} from '../context-manager';

// Mock the logger to suppress output in tests
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ContextManager', () => {
  beforeEach(() => {
    resetContextManager();
    vi.clearAllMocks();
  });

  // ── estimateTokens ─────────────────────────────────────────────────────

  describe('estimateTokens', () => {
    it('returns 0 for an empty message array', () => {
      const cm = new ContextManager();
      expect(cm.estimateTokens([])).toBe(0);
    });

    it('estimates tokens for English text using chars/4 heuristic', () => {
      const cm = new ContextManager();
      // 100 chars / 4 = 25 content + 10 overhead = 35
      const messages = [{ role: 'user', content: 'a'.repeat(100) }];
      expect(cm.estimateTokens(messages)).toBe(35);
    });

    it('adds system prompt overhead when a system message is present', () => {
      const cm = new ContextManager();
      // "You are a helpful assistant." = 28 chars → ceil(28/4)=7
      // + 10 msg overhead + 100 system overhead = 117
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'a'.repeat(100) },
      ];
      expect(cm.estimateTokens(messages)).toBe(152);
    });

    it('does not add system overhead when no system message present', () => {
      const cm = new ContextManager();
      const messages = [
        { role: 'user', content: 'a'.repeat(100) },
        { role: 'assistant', content: 'b'.repeat(100) },
      ];
      // (100 + 100) / 4 = 50 content + 20 overhead = 70
      expect(cm.estimateTokens(messages)).toBe(70);
    });

    it('scales linearly with message count', () => {
      const cm = new ContextManager();
      const single = [{ role: 'user', content: 'hello world' }];
      const doubled = [
        { role: 'user', content: 'hello world' },
        { role: 'user', content: 'hello world' },
      ];
      expect(cm.estimateTokens(doubled)).toBe(cm.estimateTokens(single) * 2);
    });

    it('handles very long messages', () => {
      const cm = new ContextManager();
      const longContent = 'x'.repeat(100_000);
      const messages = [{ role: 'user', content: longContent }];
      const tokens = cm.estimateTokens(messages);
      // 100000 / 4 = 25000 + 10 overhead = 25010
      expect(tokens).toBe(25_010);
    });
  });

  // ── checkContext ──────────────────────────────────────────────────────

  describe('checkContext', () => {
    const shortSystemPrompt = 'You are a helpful assistant.';
    const shortMessages = [{ role: 'user', content: 'Hi' }];

    it('returns withinLimit=true when messages fit comfortably', () => {
      const cm = new ContextManager({ contextLimit: 8192 });
      const result = cm.checkContext(shortMessages, shortSystemPrompt);
      expect(result.withinLimit).toBe(true);
      expect(result.action).toBe('none');
    });

    it('returns withinLimit=false when messages exceed the limit', () => {
      const cm = new ContextManager({ contextLimit: 10 });
      // "Hi"=2/4=1 + 10 overhead + 28/4=7 system content + 100 system overhead = 118 >> 10
      const result = cm.checkContext(shortMessages, shortSystemPrompt);
      expect(result.withinLimit).toBe(false);
      expect(result.action).toBe('summarize+trim');
    });

    it('triggers summarize+trim at the threshold when summarization enabled', () => {
      const cm = new ContextManager({
        contextLimit: 100,
        summarizeThreshold: 0.8,
        summarizationEnabled: true,
      });
      // Messages that exceed 0.8 * 100 = 80 tokens
      const messages = [{ role: 'user', content: 'a'.repeat(400) }];
      const result = cm.checkContext(messages, shortSystemPrompt);
      expect(result.action).toBe('summarize+trim');
    });

    it('returns trim (not summarize+trim) when summarization is disabled', () => {
      const cm = new ContextManager({
        contextLimit: 10,
        summarizationEnabled: false,
      });
      const result = cm.checkContext(shortMessages, shortSystemPrompt);
      expect(result.action).toBe('trim');
    });

    it('reports currentTokens in the result', () => {
      const cm = new ContextManager({ contextLimit: 10000 });
      const result = cm.checkContext(shortMessages, shortSystemPrompt);
      expect(result.currentTokens).toBeGreaterThan(0);
      expect(result.limitTokens).toBe(10000);
    });
  });

  // ── trimMessages ──────────────────────────────────────────────────────

  describe('trimMessages', () => {
    const systemPrompt = 'You are a helpful assistant.';

    it('returns system prompt + all messages when under budget', async () => {
      const cm = new ContextManager({ contextLimit: 10000 });
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      const result = await cm.trimMessages(messages, systemPrompt);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ role: 'system', content: systemPrompt });
      expect(result[1]).toEqual({ role: 'user', content: 'Hello' });
      expect(result[2]).toEqual({ role: 'assistant', content: 'Hi there!' });
    });

    it('always preserves the system prompt', async () => {
      const cm = new ContextManager({ contextLimit: 50 });
      const messages = [
        { role: 'user', content: 'a'.repeat(200) },
        { role: 'assistant', content: 'b'.repeat(200) },
        { role: 'user', content: 'c'.repeat(200) },
      ];
      const result = await cm.trimMessages(messages, systemPrompt);
      expect(result[0]).toEqual({ role: 'system', content: systemPrompt });
    });

    it('always preserves the last N messages (minRecent)', async () => {
      const cm = new ContextManager({
        contextLimit: 200,
        minRecent: 3,
      });
      const messages = [
        { role: 'user', content: 'msg1' },
        { role: 'assistant', content: 'msg2' },
        { role: 'user', content: 'msg3' },
        { role: 'assistant', content: 'msg4' },
        { role: 'user', content: 'msg5' },
      ];
      const result = await cm.trimMessages(messages, systemPrompt);
      // System + last 3 messages (msg3, msg4, msg5)
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ role: 'system', content: systemPrompt });
      expect(result[1]).toEqual({ role: 'user', content: 'msg3' });
      expect(result[2]).toEqual({ role: 'assistant', content: 'msg4' });
      expect(result[3]).toEqual({ role: 'user', content: 'msg5' });
    });

    it('removes oldest messages first when over budget', async () => {
      const cm = new ContextManager({
        contextLimit: 150,
        minRecent: 2,
      });
      const messages = [
        { role: 'user', content: 'oldest' },
        { role: 'assistant', content: 'older' },
        { role: 'user', content: 'mid' },
        { role: 'assistant', content: 'recent' },
        { role: 'user', content: 'newest' },
      ];
      const result = await cm.trimMessages(messages, systemPrompt);
      // System + last 2 messages (recent, newest)
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ role: 'system', content: systemPrompt });
      expect(result[1]).toEqual({ role: 'assistant', content: 'recent' });
      expect(result[2]).toEqual({ role: 'user', content: 'newest' });
    });

    it('returns only system prompt when conversation is empty', async () => {
      const cm = new ContextManager();
      const result = await cm.trimMessages([], systemPrompt);
      expect(result).toEqual([{ role: 'system', content: systemPrompt }]);
    });

    it('handles messages that are all system role (filters them out)', async () => {
      const cm = new ContextManager({ contextLimit: 10000 });
      const messages = [
        { role: 'system', content: 'sys1' },
        { role: 'system', content: 'sys2' },
      ];
      const result = await cm.trimMessages(messages, systemPrompt);
      // System messages filtered from conversation; only the systemPrompt is kept
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'system', content: systemPrompt });
    });

    it('does not mutate the original messages array', async () => {
      const cm = new ContextManager({ contextLimit: 10000 });
      const original = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ];
      const snapshot = original.map((m) => ({ ...m }));
      await cm.trimMessages(original, systemPrompt);
      expect(original).toEqual(snapshot);
    });

    it('handles empty system prompt', async () => {
      const cm = new ContextManager({ contextLimit: 10000 });
      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await cm.trimMessages(messages, '');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ role: 'system', content: '' });
      expect(result[1]).toEqual({ role: 'user', content: 'Hello' });
    });
  });

  // ── summarizeOlder ────────────────────────────────────────────────────

  describe('summarizeOlder', () => {
    it('returns recent messages and a summary of older ones', async () => {
      const cm = new ContextManager();
      const messages = [
        { role: 'user', content: 'First question about pricing' },
        { role: 'assistant', content: 'Pricing starts at $10/month' },
        { role: 'user', content: 'Second question about features' },
        { role: 'assistant', content: 'We offer 50+ features' },
        { role: 'user', content: 'Latest question about support' },
      ];
      const result = await cm.summarizeOlder(messages, 2);
      expect(result.summary.role).toBe('system');
      expect(result.summary.content).toContain('condensed');
      // Recent = last 2 messages (indices 3 and 4)
      expect(result.recent).toHaveLength(2);
      expect(result.recent[0].content).toBe('We offer 50+ features');
      expect(result.recent[1].content).toBe('Latest question about support');
    });

    it('keeps all messages as recent when keepRecent >= message count', async () => {
      const cm = new ContextManager();
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];
      // keepRecent=5 but only 2 messages → all become recent, older is empty
      const result = await cm.summarizeOlder(messages, 5);
      expect(result.recent).toHaveLength(2);
      expect(result.summary.content).toContain('condensed');
    });

    it('gracefully handles summarization failure with truncated fallback', async () => {
      const cm = new ContextManager();
      const messages = [
        { role: 'user', content: 'x'.repeat(500) },
        { role: 'assistant', content: 'y'.repeat(500) },
      ];
      const result = await cm.summarizeOlder(messages, 1);
      expect(result.summary.role).toBe('system');
      expect(result.summary.content.length).toBeGreaterThan(0);
      expect(result.recent).toHaveLength(1);
    });
  });

  // ── Factory / Singleton ───────────────────────────────────────────────

  describe('getContextManager / resetContextManager', () => {
    it('returns a new instance with default options', () => {
      const cm = getContextManager();
      expect(cm).toBeInstanceOf(ContextManager);
      expect(cm.estimateTokens([{ role: 'user', content: 'test' }])).toBeGreaterThan(0);
    });

    it('returns the same singleton on repeated calls', () => {
      const a = getContextManager();
      const b = getContextManager();
      expect(a).toBe(b);
    });

    it('creates a new instance after reset', () => {
      const a = getContextManager();
      resetContextManager();
      const b = getContextManager();
      expect(a).not.toBe(b);
    });

    it('accepts custom options via factory', () => {
      resetContextManager();
      const cm = getContextManager({ contextLimit: 4000, minRecent: 2 });
      const result = cm.checkContext([], 'prompt');
      expect(result.limitTokens).toBe(4000);
      resetContextManager();
    });
  });
});

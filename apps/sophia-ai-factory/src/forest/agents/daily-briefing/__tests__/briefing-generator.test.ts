/**
 * Tests for Daily Briefing Generator.
 *
 * Verifies:
 * - Memory cache hit returns cached briefing
 * - Memory unavailable falls back to fresh generation
 * - LLM call generates and stores briefing
 * - LLM call failure returns non-generated briefing gracefully
 * - Bilingual locale handling
 * - Section parsing from markdown
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateDailyBriefing } from '../briefing-generator';

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mock the memory adapter
vi.mock('@/land/openclaw/memory-adapter', () => ({
  memory: {
    store: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue(null),
  },
}));

// Mock the LLM router
vi.mock('@/forest/agent-chat/llm-router', () => ({
  resolveLlmRoute: vi.fn(),
}));

import { memory } from '@/land/openclaw/memory-adapter';
import { resolveLlmRoute } from '@/forest/agent-chat/llm-router';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_LLM_ROUTE = {
  provider: 'deepseek' as const,
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: 'sk-test-key',
  model: 'deepseek-reasoner',
};

const MOCK_BRIEFING_TEXT = `## Revenue Snapshot
Your platform processed $1,250 in revenue over the past 24 hours. Basic tier users represent 60% of transactions.

## Campaign Status
You have 3 active campaigns. Campaign "Summer Launch" is 78% complete.

## Active Issues
No critical issues detected at this time. One campaign template needs review.

## Summary
A productive day ahead — focus on launching the remaining campaigns.`;

const MOCK_BRIEFING_TEXT_VI = `## Tổng Quan Doanh Thu
Nền tảng của bạn đã xử lý $1,250 doanh thu trong 24 giờ qua.

## Trạng Thái Chiến Dịch
Bạn có 3 chiến dịch đang hoạt động. Chiến dịch "Summer Launch" đã hoàn thành 78%.

## Vấn Đề Cần Xử Lý
Không phát hiện vấn đề nghiêm trọng nào.

## Tóm Tắt
Một ngày hiệu quả phía trước — tập trung vào việc ra mắt các chiến dịch còn lại.`;

const mockFetchSuccess = (content: string) => {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content } }],
      }),
  });
};

const mockFetchError = (status: number, body: string) => {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  });
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('generateDailyBriefing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: LLM route resolves successfully
    vi.mocked(resolveLlmRoute).mockResolvedValue(MOCK_LLM_ROUTE);
    // Default: no cached briefing
    vi.mocked(memory.query).mockResolvedValue(null);
    // Default: fetch succeeds with English briefing
    globalThis.fetch = mockFetchSuccess(MOCK_BRIEFING_TEXT) as unknown as typeof fetch;
  });

  describe('memory cache', () => {
    it('returns cached briefing when available', async () => {
      const cachedBriefing = {
        date: new Date().toISOString().slice(0, 10),
        generatedAt: new Date().toISOString(),
        rawText: MOCK_BRIEFING_TEXT,
        summary: 'A productive day ahead — focus on launching the remaining campaigns.',
        locale: 'en',
        generated: true,
      };

      vi.mocked(memory.query).mockResolvedValue(cachedBriefing);

      const result = await generateDailyBriefing('user-1', 'en');

      expect(result).not.toBeNull();
      expect(result?.rawText).toBe(MOCK_BRIEFING_TEXT);
      expect(result?.generated).toBe(true);
      // Should NOT call LLM when cached
      expect(resolveLlmRoute).not.toHaveBeenCalled();
    });

    it('generates fresh briefing when no cache exists', async () => {
      const result = await generateDailyBriefing('user-1', 'en');

      expect(result).not.toBeNull();
      expect(result?.generated).toBe(true);
      expect(result?.rawText).toBe(MOCK_BRIEFING_TEXT);
      expect(result?.summary).toBe(
        'A productive day ahead — focus on launching the remaining campaigns.',
      );
      expect(resolveLlmRoute).toHaveBeenCalledWith('user-1');
    });

    it('generates fresh when memory query fails', async () => {
      vi.mocked(memory.query).mockRejectedValue(new Error('D1 unavailable'));

      const result = await generateDailyBriefing('user-1', 'en');

      expect(result).not.toBeNull();
      expect(result?.generated).toBe(true);
      expect(memory.store).toHaveBeenCalled();
    });
  });

  describe('LLM integration', () => {
    it('stores generated briefing in memory', async () => {
      const result = await generateDailyBriefing('user-1', 'en');

      expect(result).not.toBeNull();
      expect(memory.store).toHaveBeenCalledWith(
        'agent',
        expect.stringContaining('daily-briefing:'),
        expect.objectContaining({
          generated: true,
          locale: 'en',
        }),
        'user-1',
      );
    });

    it('generates Vietnamese briefing when locale is vi', async () => {
      globalThis.fetch = mockFetchSuccess(MOCK_BRIEFING_TEXT_VI) as unknown as typeof fetch;

      const result = await generateDailyBriefing('user-1', 'vi');

      expect(result).not.toBeNull();
      expect(result?.locale).toBe('vi');
      expect(result?.rawText).toBe(MOCK_BRIEFING_TEXT_VI);
      expect(result?.summary).toBe(
        'Một ngày hiệu quả phía trước — tập trung vào việc ra mắt các chiến dịch còn lại.',
      );
    });

    it('handles LLM route resolution failure gracefully', async () => {
      vi.mocked(resolveLlmRoute).mockRejectedValue(new Error('NO_LLM_CONFIGURED'));

      const result = await generateDailyBriefing('user-1', 'en');

      expect(result).not.toBeNull();
      expect(result?.generated).toBe(false);
      // Should still return a non-null briefing with error message
      expect(result?.rawText).toContain('not yet available');
    });

    it('handles HTTP error from LLM and retries', async () => {
      // First call fails, second succeeds
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Rate limited'),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: MOCK_BRIEFING_TEXT } }],
            }),
        });

      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const result = await generateDailyBriefing('user-1', 'en');

      expect(result).not.toBeNull();
      expect(result?.generated).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('handles all LLM retries exhausted gracefully', async () => {
      globalThis.fetch = mockFetchError(500, 'Server error') as unknown as typeof fetch;

      const result = await generateDailyBriefing('user-1', 'en');

      expect(result).not.toBeNull();
      expect(result?.generated).toBe(false);
      expect(result?.rawText).toContain('not yet available');
    });
  });

  describe('section parsing', () => {
    it('extracts Summary section from markdown', async () => {
      const result = await generateDailyBriefing('user-1', 'en');

      expect(result?.summary).toBe(
        'A productive day ahead — focus on launching the remaining campaigns.',
      );
    });

    it('falls back to last paragraph when no ## Summary section', async () => {
      const textWithoutSummary = `## Section One
Content here.

## Section Two
More content.`;

      globalThis.fetch = mockFetchSuccess(textWithoutSummary) as unknown as typeof fetch;

      const result = await generateDailyBriefing('user-1', 'en');
      // Fallback uses the last paragraph (includes heading text)
      expect(result?.summary).toContain('More content.');
    });
  });
});

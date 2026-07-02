/**
 * LLM Fallback Generator Tests — validates the D1→KV→LLM fallback chain.
 *
 * Covers:
 *   - D1 miss → KV miss → LLM generation happy path
 *   - D1 hit returns curated content immediately (bypasses KV + LLM)
 *   - KV cache hit returns cached content (bypasses LLM)
 *   - LLM response with markdown code fences is properly stripped
 *   - LLM timeout throws
 *   - Missing API key throws
 *   - Invalid JSON from LLM throws
 *   - Zod validation failure throws
 *
 * @module tree/landing/llm-fallback-generator.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockGetBySlug } = vi.hoisted(() => ({ mockGetBySlug: vi.fn() }));
vi.mock('@/seed/db/repositories/landing-pages-repo', () => ({
  getBySlug: mockGetBySlug,
}));

const { mockGetCached, mockSetCached } = vi.hoisted(() => ({
  mockGetCached: vi.fn(),
  mockSetCached: vi.fn(),
}));
vi.mock('@/seed/kv/landing-cache-ops', () => ({
  getCachedLandingPage: mockGetCached,
  setCachedLandingPage: mockSetCached,
}));

const { mockResilientChat } = vi.hoisted(() => ({
  mockResilientChat: vi.fn(),
}));
vi.mock('@/seed/inference/openrouter-client', () => ({
  resilientChatCompletion: mockResilientChat,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { generateLandingPageContent } from './llm-fallback-generator';

import type { GeneratedLandingContent } from '@/seed/types/landing-page-types';

const VALID_LLM_RESPONSE: GeneratedLandingContent = {
  heroTitleEn: 'AI Video for Real Estate',
  heroTitleVi: 'Video AI Cho Bất Động Sản',
  heroSubEn: 'Generate stunning property videos',
  heroSubVi: 'Tạo video bất động sản ấn tượng',
  features: [
    { icon: 'camera', title_en: 'Virtual Tours', title_vi: 'Tham quan ảo', desc_en: 'Show properties in 3D', desc_vi: 'Trình bày bất động sản 3D' },
    { icon: 'chart', title_en: 'Analytics', title_vi: 'Phân tích', desc_en: 'Track engagement', desc_vi: 'Theo dõi tương tác' },
    { icon: 'globe', title_en: 'Global Reach', title_vi: 'Tiếp cận toàn cầu', desc_en: 'Reach buyers worldwide', desc_vi: 'Tiếp cận người mua toàn cầu' },
  ],
  faq: [
    { question_en: 'How does it work?', question_vi: 'Nó hoạt động thế nào?', answer_en: 'Simple upload and generate', answer_vi: 'Tải lên và tạo đơn giản' },
    { question_en: 'Is it expensive?', question_vi: 'Có đắt không?', answer_en: 'Affordable pricing', answer_vi: 'Giá cả hợp lý' },
    { question_en: 'Can I customize?', question_vi: 'Tôi có thể tùy chỉnh?', answer_en: 'Yes, fully customizable', answer_vi: 'Có, hoàn toàn tùy chỉnh' },
  ],
  metaTitleEn: 'AI Video for Real Estate Agents',
  metaTitleVi: 'Video AI Cho Môi Giới Bất Động Sản',
  metaDescEn: 'Transform your real estate marketing with AI-generated videos.',
  metaDescVi: 'Biến đổi tiếp thị bất động sản với video AI.',
};

describe('llm-fallback-generator', () => {
  const NICHE = 'real-estate';

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  describe('D1 hit (curated content)', () => {
    it('returns curated content immediately when D1 has the page', async () => {
      mockGetBySlug.mockResolvedValue({
        id: 'real-estate',
        nicheLabel: 'Real Estate / Bất Động Sản',
        heroTitleEn: 'Curated Title',
        heroTitleVi: 'Tiêu đề đã quản lý',
        heroSubEn: null,
        heroSubVi: null,
        features: [],
        faq: [],
        metaTitleEn: null,
        metaTitleVi: null,
        metaDescEn: null,
        metaDescVi: null,
        isPublished: true,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      });

      const result = await generateLandingPageContent(NICHE, 'sk-or-v1-test-key');

      expect(result.heroTitleEn).toBe('Curated Title');
      expect(mockGetCached).not.toHaveBeenCalled();
      expect(mockResilientChat).not.toHaveBeenCalled();
    });
  });

  describe('KV cache hit', () => {
    it('returns cached content when D1 misses and KV hits', async () => {
      mockGetBySlug.mockResolvedValue(null);
      mockGetCached.mockResolvedValue(VALID_LLM_RESPONSE);

      const result = await generateLandingPageContent(NICHE, 'sk-or-v1-test-key');

      expect(result).toEqual(VALID_LLM_RESPONSE);
      expect(mockResilientChat).not.toHaveBeenCalled();
      expect(mockSetCached).not.toHaveBeenCalled();
    });
  });

  describe('LLM generation happy path', () => {
    it('generates, validates, caches, and returns content', async () => {
      mockGetBySlug.mockResolvedValue(null);
      mockGetCached.mockResolvedValue(null);
      mockResilientChat.mockResolvedValue(JSON.stringify(VALID_LLM_RESPONSE));

      const result = await generateLandingPageContent(NICHE, 'sk-or-v1-test-key');

      expect(result).toEqual(VALID_LLM_RESPONSE);
      expect(mockSetCached).toHaveBeenCalledWith(NICHE, expect.any(String), VALID_LLM_RESPONSE);
    });

    it('uses environment variable when apiKey not provided', async () => {
      process.env.OPENROUTER_API_KEY = 'env-or-key';
      mockGetBySlug.mockResolvedValue(null);
      mockGetCached.mockResolvedValue(null);
      mockResilientChat.mockResolvedValue(JSON.stringify(VALID_LLM_RESPONSE));

      const result = await generateLandingPageContent(NICHE);

      expect(result).toEqual(VALID_LLM_RESPONSE);
      expect(mockResilientChat).toHaveBeenCalled();
    });
  });

  describe('LLM response edge cases', () => {
    it('strips markdown code fences from LLM response', async () => {
      mockGetBySlug.mockResolvedValue(null);
      mockGetCached.mockResolvedValue(null);
      const jsonWithFences = '```json\n' + JSON.stringify(VALID_LLM_RESPONSE) + '\n```';
      mockResilientChat.mockResolvedValue(jsonWithFences);

      const result = await generateLandingPageContent(NICHE, 'sk-or-v1-test-key');

      expect(result).toEqual(VALID_LLM_RESPONSE);
    });

    it('strips markdown code fences without json tag', async () => {
      mockGetBySlug.mockResolvedValue(null);
      mockGetCached.mockResolvedValue(null);
      const jsonWithFences = '```\n' + JSON.stringify(VALID_LLM_RESPONSE) + '\n```';
      mockResilientChat.mockResolvedValue(jsonWithFences);

      const result = await generateLandingPageContent(NICHE, 'sk-or-v1-test-key');

      expect(result).toEqual(VALID_LLM_RESPONSE);
    });

    it('throws when LLM returns invalid JSON', async () => {
      mockGetBySlug.mockResolvedValue(null);
      mockGetCached.mockResolvedValue(null);
      mockResilientChat.mockResolvedValue('This is not JSON at all');

      await expect(generateLandingPageContent(NICHE, 'sk-or-v1-test-key')).rejects.toThrow('not valid JSON');
    });

    it('throws when LLM returns JSON that fails Zod validation', async () => {
      mockGetBySlug.mockResolvedValue(null);
      mockGetCached.mockResolvedValue(null);
      // Missing required fields (no heroTitleEn, etc.)
      mockResilientChat.mockResolvedValue(JSON.stringify({ features: [], faq: [] }));

      await expect(generateLandingPageContent(NICHE, 'sk-or-v1-test-key')).rejects.toThrow('Failed to generate landing page');
    });
  });

  describe('error handling', () => {
    it('throws when no OpenRouter key is available', async () => {
      mockGetBySlug.mockResolvedValue(null);
      mockGetCached.mockResolvedValue(null);

      await expect(generateLandingPageContent(NICHE)).rejects.toThrow('No OpenRouter API key available');
      expect(mockResilientChat).not.toHaveBeenCalled();
    });

    it('throws when resilientChatCompletion rejects', async () => {
      mockGetBySlug.mockResolvedValue(null);
      mockGetCached.mockResolvedValue(null);
      mockResilientChat.mockRejectedValue(new Error('OpenRouter 429 rate limited'));

      await expect(generateLandingPageContent(NICHE, 'sk-or-v1-test-key')).rejects.toThrow('Failed to generate landing page');
    });
  });
});

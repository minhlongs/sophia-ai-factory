/**
 * Landing Page Cache Ops Tests — validates KV get/set with TTL expiry.
 *
 * Covers:
 *   - getCachedLandingPage: KV hit, KV miss, expired entry, KV unavailable
 *   - setCachedLandingPage: stores with TTL, KV unavailable (no-op)
 *
 * @module seed/kv/landing-cache-ops.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCachedLandingPage,
  setCachedLandingPage,
} from './landing-cache-ops';

import type { GeneratedLandingContent } from '@/seed/types/landing-page-types';

/** Reusable sample generated content */
const SAMPLE_CONTENT: GeneratedLandingContent = {
  heroTitleEn: 'Test Title',
  heroTitleVi: 'Tiêu đề Kiểm tra',
  heroSubEn: 'Test subtitle',
  heroSubVi: 'Phụ đề kiểm tra',
  features: [
    { icon: 'star', title_en: 'Feature 1', title_vi: 'Tính năng 1', desc_en: 'Description 1', desc_vi: 'Mô tả 1' },
    { icon: 'heart', title_en: 'Feature 2', title_vi: 'Tính năng 2', desc_en: 'Description 2', desc_vi: 'Mô tả 2' },
    { icon: 'bolt', title_en: 'Feature 3', title_vi: 'Tính năng 3', desc_en: 'Description 3', desc_vi: 'Mô tả 3' },
  ],
  faq: [
    { question_en: 'Q1?', question_vi: 'CH1?', answer_en: 'A1', answer_vi: 'TL1' },
    { question_en: 'Q2?', question_vi: 'CH2?', answer_en: 'A2', answer_vi: 'TL2' },
    { question_en: 'Q3?', question_vi: 'CH3?', answer_en: 'A3', answer_vi: 'TL3' },
  ],
  metaTitleEn: 'Meta Title',
  metaTitleVi: 'Tiêu đề Meta',
  metaDescEn: 'Meta description here',
  metaDescVi: 'Mô tả meta ở đây',
};

describe('landing-cache-ops', () => {
  let kvStore: Map<string, string>;
  let kvMock: { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    // Fresh in-memory KV store per test
    kvStore = new Map<string, string>();
    kvMock = {
      get: vi.fn(async (key: string) => kvStore.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => { kvStore.set(key, value); }),
    };
    (globalThis as Record<string, unknown>).KV_KV = kvMock;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).KV_KV;
  });

  describe('getCachedLandingPage', () => {
    it('returns null when KV binding is unavailable', async () => {
      delete (globalThis as Record<string, unknown>).KV_KV;

      const result = await getCachedLandingPage('real-estate');
      expect(result).toBeNull();
    });

    it('returns null on KV miss (no cached entry)', async () => {
      const result = await getCachedLandingPage('unknown-niche');
      expect(result).toBeNull();
      expect(kvMock.get).toHaveBeenCalledWith('landing:niche:unknown-niche', 'json');
    });

    it('returns null when KV.get returns null', async () => {
      kvMock.get.mockResolvedValue(null);

      const result = await getCachedLandingPage('real-estate');
      expect(result).toBeNull();
    });

    it('returns content on KV hit within TTL', async () => {
      const entry = {
        content: SAMPLE_CONTENT,
        nicheLabel: 'Real Estate / Bất Động Sản',
        generatedAt: Date.now(),
        ttl: 7 * 24 * 60 * 60,
      };
      kvMock.get.mockResolvedValue(entry);

      const result = await getCachedLandingPage('real-estate');

      expect(result).toEqual(SAMPLE_CONTENT);
    });

    it('returns null when cached content has expired', async () => {
      const expiredEntry = {
        content: SAMPLE_CONTENT,
        nicheLabel: 'Real Estate / Bất Động Sản',
        generatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago (TTL is 7)
        ttl: 7 * 24 * 60 * 60,
      };
      kvMock.get.mockResolvedValue(expiredEntry);

      const result = await getCachedLandingPage('real-estate');

      expect(result).toBeNull();
    });

    it('returns null when KV get throws', async () => {
      kvMock.get.mockRejectedValue(new Error('KV unavailable'));

      const result = await getCachedLandingPage('real-estate');

      expect(result).toBeNull();
    });
  });

  describe('setCachedLandingPage', () => {
    it('stores content in KV with correct TTL', async () => {
      await setCachedLandingPage('real-estate', 'Real Estate / Bất Động Sản', SAMPLE_CONTENT);

      expect(kvMock.put).toHaveBeenCalledWith(
        'landing:niche:real-estate',
        expect.any(String),
        { expirationTtl: 7 * 24 * 60 * 60 },
      );

      // Verify stored JSON can be parsed back
      const storedJson = kvMock.put.mock.calls[0][1];
      const parsed = JSON.parse(storedJson);
      expect(parsed.content).toEqual(SAMPLE_CONTENT);
      expect(parsed.nicheLabel).toBe('Real Estate / Bất Động Sản');
      expect(typeof parsed.generatedAt).toBe('number');
      expect(parsed.ttl).toBe(7 * 24 * 60 * 60);
    });

    it('is a no-op when KV binding is unavailable', async () => {
      delete (globalThis as Record<string, unknown>).KV_KV;

      // Should not throw
      await expect(
        setCachedLandingPage('real-estate', 'Label', SAMPLE_CONTENT),
      ).resolves.toBeUndefined();
    });

    it('does not throw when KV put fails', async () => {
      kvMock.put.mockRejectedValue(new Error('KV put error'));

      await expect(
        setCachedLandingPage('real-estate', 'Label', SAMPLE_CONTENT),
      ).resolves.toBeUndefined();
    });
  });
});

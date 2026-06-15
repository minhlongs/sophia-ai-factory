/**
 * Unit tests for generateSeoScript — pure scorer math, validation,
 * BYOK guard, OpenRouter happy path, and parsing of TITLE: lines.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const { mockResolveUserApiKey } = vi.hoisted(() => ({
  mockResolveUserApiKey: vi.fn(),
}));

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: mockResolveUserApiKey,
  isByokEnabled: () => true,
}));

import {
  generateSeoScript,
  countKeywordHits,
  scoreSeo,
  SeoScriptConfigurationError,
} from '@/land/scripts/generate-seo-script';
import { resetOpenRouterCircuit } from '@/seed/inference/openrouter-client';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };
afterAll(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = ORIGINAL_ENV;
});

function stubFetch(content: string, ok = true, status = 200): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    headers: { get: () => null },
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => content,
  }) as unknown as typeof globalThis.fetch;
}

describe('countKeywordHits', () => {
  it('matches whole words case-insensitively', () => {
    const out = countKeywordHits('Affiliate marketing for beginners. Marketing tips.', ['marketing', 'beginners']);
    expect(out.find((c) => c.keyword === 'marketing')!.hits).toBe(2);
    expect(out.find((c) => c.keyword === 'beginners')!.hits).toBe(1);
  });
  it('does not count partial-word matches', () => {
    const out = countKeywordHits('marketplaces and supermarkets', ['market']);
    expect(out[0].hits).toBe(0);
  });
  it('escapes regex special chars', () => {
    const out = countKeywordHits('Use C++ for speed', ['C++']);
    expect(out[0].hits).toBe(1);
  });
});

describe('scoreSeo', () => {
  it('full marks when everything aligns', () => {
    const body = '# Title with seo\n## Intro\nseo tips for the win.\n## Outro\nMore seo content.\n'.repeat(1);
    const longBody = body + ' word'.repeat(200);
    const { score } = scoreSeo({
      body: longBody,
      title: 'Title with seo',
      keywords: ['seo'],
      primaryKeyword: 'seo',
      wordCount: 200,
      min: 180,
      max: 260,
    });
    expect(score).toBeGreaterThanOrEqual(95);
  });
  it('drops when keyword absent from title', () => {
    const { score } = scoreSeo({
      body: '## Section\n## Section Two\nseo seo seo',
      title: 'No primary here',
      keywords: ['seo'],
      primaryKeyword: 'seo',
      wordCount: 200,
      min: 180,
      max: 260,
    });
    // 60 coverage + 0 title + 10 headings (≥2) + 10 length = 80
    expect(score).toBe(80);
  });
  it('penalizes missing headings', () => {
    const { score } = scoreSeo({
      body: 'one big paragraph with seo inside',
      title: 'seo guide',
      keywords: ['seo'],
      primaryKeyword: 'seo',
      wordCount: 200,
      min: 180,
      max: 260,
    });
    // 60 coverage + 20 title + 0 headings + 10 length = 90
    expect(score).toBe(90);
  });
});

describe('generateSeoScript', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOpenRouterCircuit();
    mockResolveUserApiKey.mockResolvedValue('user-key');
    delete process.env.OPENROUTER_API_KEY;
  });

  it('rejects empty topic', async () => {
    await expect(
      generateSeoScript({ userId: 'u1', topic: '   ' }),
    ).rejects.toBeInstanceOf(SeoScriptConfigurationError);
  });

  it('throws BYOK_REQUIRED when no key resolved', async () => {
    mockResolveUserApiKey.mockResolvedValue(null);
    try {
      await generateSeoScript({ userId: 'u1', topic: 'affiliate marketing' });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SeoScriptConfigurationError);
      expect((err as SeoScriptConfigurationError).code).toBe('BYOK_REQUIRED');
    }
  });

  it('parses script + titles from happy-path response', async () => {
    const llmOutput = [
      '# 5 Affiliate Marketing Tips',
      '## Why it works',
      'Affiliate marketing wins because it compounds. '.repeat(20),
      '## Get started',
      'Sign up, pick a niche, ship. Affiliate marketing now.',
      'TITLE: Affiliate Marketing for Beginners',
      'TITLE: 5 Affiliate Marketing Hacks',
      'TITLE: Affiliate Marketing in 2026',
    ].join('\n');
    stubFetch(llmOutput);
    const result = await generateSeoScript({
      userId: 'u1',
      topic: 'affiliate marketing',
      keywords: ['affiliate', 'marketing'],
      language: 'en',
    });
    expect(result.suggestedTitles).toHaveLength(3);
    expect(result.script).toContain('# 5 Affiliate Marketing Tips');
    expect(result.script).not.toContain('TITLE:');
    expect(result.seoScore).toBeGreaterThan(50);
    expect(result.keywordCoverage.length).toBe(2);
    expect(result.source).toBe('user');
  });

  it('bubbles non-2xx upstream', async () => {
    stubFetch('rate limited', false, 429);
    // 429 triggers retries; allow enough time for backoff (max ~7s)
    await expect(
      generateSeoScript({ userId: 'u1', topic: 'x' }),
    ).rejects.toThrow(/429/);
  }, 15000);

  it('marks source=platform when env key used', async () => {
    process.env.OPENROUTER_API_KEY = 'env-key';
    mockResolveUserApiKey.mockResolvedValue('env-key');
    stubFetch('# T\n## A\nbody body body\nTITLE: One');
    const result = await generateSeoScript({ userId: 'u1', topic: 'topic' });
    expect(result.source).toBe('platform');
  });
});

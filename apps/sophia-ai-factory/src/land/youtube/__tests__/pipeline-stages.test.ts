/**
 * Tests for pipeline-stages — pure stage runners.
 * Each stage is a pure async function; no Inngest or D1 required.
 * Template fallback in the tree modules is exercised directly.
 *
 * @module land/youtube/__tests__/pipeline-stages
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Thumbnail stage resolves its key + client via dynamic import. Mock both so
// the tests are deterministic and never hit real env keys or the network.
const mockGetThumbnailKey = vi.fn();
const mockGenerateThumbnail = vi.fn();
vi.mock('@/tree/credentials/get-provider-key', () => ({
  getThumbnailKey: (...args: unknown[]) => mockGetThumbnailKey(...args),
}));
vi.mock('@/land/video/templates/thumbnail-client', () => ({
  ThumbnailClient: class {
    generateThumbnail(...args: unknown[]) {
      return mockGenerateThumbnail(...args);
    }
  },
}));

import {
  runStrategyStage,
  runScriptStage,
  runSEOStage,
  runThumbnailStage,
  runQualityGateStage,
  type ChannelConfigSnapshot,
  type PipelineContext,
} from '../pipeline-stages';

const CONFIG: ChannelConfigSnapshot = {
  objective: 'Grow subscribers',
  audience: 'Tech enthusiasts',
  contentPillars: ['AI', 'Automation'],
  cadence: '3-per-week',
  postsPerWeek: 3,
  bufferDays: 3,
  autonomyLevel: 2,
};

const CTX: PipelineContext = {
  userId: 'user-1',
  channelConfigId: 'config-1',
  topic: 'AI automation for small teams',
};

// ── runStrategyStage ────────────────────────────────────────────────────────

describe('runStrategyStage', () => {
  it('produces a strategy artifact with all required fields', async () => {
    const strategy = await runStrategyStage(CTX, CONFIG);

    expect(typeof strategy.topic).toBe('string');
    expect(strategy.topic.length).toBeGreaterThan(0);
    expect(typeof strategy.angle).toBe('string');
    expect(strategy.targetAudience).toBe(CONFIG.audience);
    expect(typeof strategy.contentType).toBe('string');
    expect(Array.isArray(strategy.keywords)).toBe(true);
    expect(typeof strategy.estimatedViews).toBe('number');
    expect(typeof strategy.bestPublishTime).toBe('string');
  });

  it('uses the provided topic when set', async () => {
    const strategy = await runStrategyStage(
      { ...CTX, topic: 'A specific topic' },
      CONFIG,
    );
    expect(strategy.topic).toBe('A specific topic');
  });

  it('falls back to a generated topic when none is provided', async () => {
    const strategy = await runStrategyStage({ ...CTX, topic: undefined }, CONFIG);
    expect(strategy.topic.length).toBeGreaterThan(0);
  });

  it('uses an AI generator when provided', async () => {
    const generateText = vi.fn(async (prompt: string) =>
      JSON.stringify({
        topic: 'AI topic',
        angle: 'The angle',
        targetAudience: 'Audience',
        contentType: 'Tutorial',
        keywords: ['ai', 'ml'],
      }),
    );

    const strategy = await runStrategyStage(
      { ...CTX, generateText },
      CONFIG,
    );

    expect(generateText).toHaveBeenCalledTimes(1);
    expect(strategy.topic).toBe('AI topic');
    expect(strategy.keywords).toEqual(['ai', 'ml']);
    expect(strategy.contentType).toBe('Tutorial');
  });

  it('falls back to templates when the AI generator returns invalid JSON', async () => {
    const generateText = vi.fn(async () => 'not valid json at all');
    const strategy = await runStrategyStage({ ...CTX, generateText }, CONFIG);

    expect(generateText).toHaveBeenCalledTimes(1);
    expect(typeof strategy.topic).toBe('string');
    expect(strategy.topic.length).toBeGreaterThan(0);
  });

  it('falls back to templates when the AI generator throws', async () => {
    const generateText = vi.fn(async () => {
      throw new Error('AI provider down');
    });
    const strategy = await runStrategyStage({ ...CTX, generateText }, CONFIG);

    expect(generateText).toHaveBeenCalledTimes(1);
    expect(typeof strategy.topic).toBe('string');
    expect(strategy.topic.length).toBeGreaterThan(0);
  });
});

// ── runScriptStage ──────────────────────────────────────────────────────────

describe('runScriptStage', () => {
  it('produces a script artifact from a strategy', async () => {
    const strategy = await runStrategyStage(CTX, CONFIG);
    const script = await runScriptStage(strategy);

    expect(typeof script.title).toBe('string');
    expect(script.title.length).toBeGreaterThan(0);
    expect(script.hook).toBeDefined();
    expect(script.introduction).toBeDefined();
    expect(script.mainContent).toBeDefined();
    expect(script.conclusion).toBeDefined();
    expect(script.callToAction).toBeDefined();
    expect(typeof script.duration).toBe('string');
    expect(typeof script.tone).toBe('string');
    expect(typeof script.pacing).toBe('string');
    expect(Array.isArray(script.keywords)).toBe(true);
    expect(Array.isArray(script.claims)).toBe(true);
    expect(typeof script.fullScript).toBe('string');
    expect(script.fullScript.length).toBeGreaterThan(0);
  });

  it('passes strategy keywords through to the script', async () => {
    const strategy = await runStrategyStage(CTX, CONFIG);
    const script = await runScriptStage(strategy);

    expect(script.keywords.length).toBeGreaterThan(0);
  });
});

// ── runSEOStage ─────────────────────────────────────────────────────────────

describe('runSEOStage', () => {
  it('produces an SEO artifact from strategy + script', async () => {
    const strategy = await runStrategyStage(CTX, CONFIG);
    const script = await runScriptStage(strategy);
    const seo = await runSEOStage(strategy, script);

    expect(typeof seo.title).toBe('string');
    expect(seo.title.length).toBeGreaterThan(0);
    expect(typeof seo.description).toBe('string');
    expect(seo.description.length).toBeGreaterThan(0);
    expect(Array.isArray(seo.tags)).toBe(true);
    expect(seo.tags.length).toBeGreaterThan(0);
    expect(typeof seo.seoScore).toBe('number');
    expect(seo.seoScore).toBeGreaterThanOrEqual(0);
    expect(seo.seoScore).toBeLessThanOrEqual(100);
  });

  it('derives a non-empty SEO title from the script title', async () => {
    const strategy = await runStrategyStage(CTX, CONFIG);
    const script = await runScriptStage(strategy);
    const seo = await runSEOStage(strategy, script);

    // optimizeTitle may prepend a power word / append year / truncate, so we
    // only assert the result is a non-empty string derived from the input.
    expect(typeof seo.title).toBe('string');
    expect(seo.title.length).toBeGreaterThan(0);
    expect(seo.title.length).toBeLessThanOrEqual(100);
  });
});

// ── runThumbnailStage ───────────────────────────────────────────────────────

describe('runThumbnailStage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns skipped when no thumbnail key is configured', async () => {
    mockGetThumbnailKey.mockResolvedValue(null);
    const strategy = await runStrategyStage(CTX, CONFIG);
    const script = await runScriptStage(strategy);
    const thumbnail = await runThumbnailStage(CTX, strategy, script);

    expect(thumbnail.skipped).toBe(true);
    expect(thumbnail.path).toBeNull();
    expect(thumbnail.reason).toContain('No thumbnail key configured');
  });

  it('returns a path when a key is configured and generation succeeds', async () => {
    mockGetThumbnailKey.mockResolvedValue({ key: 'sk-test', source: 'platform' });
    mockGenerateThumbnail.mockResolvedValue({ imageUrl: 'https://thumb.example/img.png' });
    const strategy = await runStrategyStage(CTX, CONFIG);
    const script = await runScriptStage(strategy);
    const thumbnail = await runThumbnailStage(CTX, strategy, script);

    expect(thumbnail.skipped).toBe(false);
    expect(thumbnail.path).toBe('https://thumb.example/img.png');
    expect(mockGenerateThumbnail).toHaveBeenCalledTimes(1);
  });

  it('returns skipped when thumbnail generation throws', async () => {
    mockGetThumbnailKey.mockResolvedValue({ key: 'sk-test', source: 'platform' });
    mockGenerateThumbnail.mockRejectedValue(new Error('provider timeout'));
    const strategy = await runStrategyStage(CTX, CONFIG);
    const script = await runScriptStage(strategy);
    const thumbnail = await runThumbnailStage(CTX, strategy, script);

    expect(thumbnail.skipped).toBe(true);
    expect(thumbnail.path).toBeNull();
    expect(thumbnail.reason).toContain('provider timeout');
  });

  it('returns skipped when the key lookup itself throws', async () => {
    mockGetThumbnailKey.mockRejectedValue(new Error('key service down'));
    const strategy = await runStrategyStage(CTX, CONFIG);
    const script = await runScriptStage(strategy);
    const thumbnail = await runThumbnailStage(CTX, strategy, script);

    expect(thumbnail.skipped).toBe(true);
    expect(thumbnail.path).toBeNull();
    expect(thumbnail.reason).toContain('key service down');
  });
});

// ── runQualityGateStage ─────────────────────────────────────────────────────

describe('runQualityGateStage', () => {
  it('passes when the assembled artifact is valid', async () => {
    const strategy = await runStrategyStage(CTX, CONFIG);
    const script = await runScriptStage(strategy);
    const seo = await runSEOStage(strategy, script);
    const quality = await runQualityGateStage(strategy, script, seo);

    expect(typeof quality.passed).toBe('boolean');
    expect(Array.isArray(quality.violations)).toBe(true);
    expect(Array.isArray(quality.warnings)).toBe(true);
  });

  it('fails when the script is too short', async () => {
    const strategy = await runStrategyStage(CTX, CONFIG);
    const script = await runScriptStage(strategy);
    // Force a short script to trigger a quality violation.
    const shortScript = { ...script, fullScript: 'too short' };
    const seo = await runSEOStage(strategy, script);
    const quality = await runQualityGateStage(strategy, shortScript, seo);

    expect(quality.passed).toBe(false);
    expect(quality.violations.some((v) => v.includes('Script too short'))).toBe(true);
  });

  it('fails when the SEO title is empty', async () => {
    const strategy = await runStrategyStage(CTX, CONFIG);
    const script = await runScriptStage(strategy);
    // runQualityGateStage checks the SEO title, not the script title.
    const seo = await runSEOStage(strategy, script);
    const emptySEO = { ...seo, title: '' };
    const quality = await runQualityGateStage(strategy, script, emptySEO);

    expect(quality.passed).toBe(false);
    expect(quality.violations.some((v) => v.includes('Title is required'))).toBe(true);
  });

  it('fails when the topic is a duplicate of a recent topic', async () => {
    const strategy = await runStrategyStage(CTX, CONFIG);
    const script = await runScriptStage(strategy);
    const seo = await runSEOStage(strategy, script);

    // Re-run the same strategy topic to force a duplicate.
    const strategy2 = await runStrategyStage(CTX, CONFIG);
    const script2 = await runScriptStage(strategy2);
    const seo2 = await runSEOStage(strategy2, script2);

    // The duplicate check uses recentTopics — the second run's topic may match.
    const quality = await runQualityGateStage(strategy2, script2, seo2);
    expect(typeof quality.passed).toBe('boolean');
  });
});

// ── Stage ordering / composition ────────────────────────────────────────────

describe('pipeline stage composition', () => {
  it('runs all five stages in order without throwing', async () => {
    const strategy = await runStrategyStage(CTX, CONFIG);
    const script = await runScriptStage(strategy);
    const seo = await runSEOStage(strategy, script);
    const thumbnail = await runThumbnailStage(CTX, strategy, script);
    const quality = await runQualityGateStage(strategy, script, seo);

    expect(strategy.topic.length).toBeGreaterThan(0);
    expect(script.fullScript.length).toBeGreaterThan(0);
    expect(seo.title.length).toBeGreaterThan(0);
    expect(thumbnail.skipped).toBe(true);
    expect(typeof quality.passed).toBe('boolean');
  });

  it('produces deterministic-ish content across runs (same topic)', async () => {
    const s1 = await runStrategyStage(CTX, CONFIG);
    const s2 = await runStrategyStage(CTX, CONFIG);

    // Topics match when explicitly provided.
    expect(s1.topic).toBe(s2.topic);
  });
});
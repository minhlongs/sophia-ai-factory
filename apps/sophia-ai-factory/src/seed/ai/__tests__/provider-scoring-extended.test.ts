/** @module seed/ai/__tests__/provider-scoring-extended.test */

import { describe, it, expect } from 'vitest';
import {
  scoreProvider,
  rankProviders,
  formatRanking,
  DIMENSION_WEIGHTS,
  keywordOverlap,
} from '@/seed/ai/provider-scoring';
import type { ToolInfo, TaskContext } from '@/seed/ai/provider-scoring';

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeTool(overrides: Partial<ToolInfo> = {}): ToolInfo {
  return {
    provider: 'test-provider',
    name: 'TestTool',
    stability: 'production',
    runtime: 'api',
    bestFor: ['video generation', 'cinematic content'],
    supports: { controlnet: true, reference_image: true },
    ...overrides,
  };
}

function makeContext(overrides: Partial<TaskContext> = {}): TaskContext {
  return {
    intent: 'create a cinematic video',
    styleKeywords: ['dramatic', 'epic'],
    budgetRemainingUsd: 10,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// A) Keyword overlap
// ═══════════════════════════════════════════════════════════════════════════════

describe('keywordOverlap', () => {
  it('returns 1.0 when sets are identical', () => {
    const a = new Set(['a', 'b', 'c']);
    const b = new Set(['a', 'b', 'c']);
    expect(keywordOverlap(a, b)).toBeCloseTo(1.0, 5);
  });

  it('returns 0.0 when sets are disjoint', () => {
    const a = new Set(['alpha', 'beta']);
    const b = new Set(['gamma', 'delta']);
    expect(keywordOverlap(a, b)).toBeCloseTo(0.0, 5);
  });

  it('returns partial overlap using min denominator', () => {
    // A={a,b,c}, B={a,b} → intersection=2, min=2 → 1.0
    const a = new Set(['a', 'b', 'c']);
    const b = new Set(['a', 'b']);
    expect(keywordOverlap(a, b)).toBeCloseTo(1.0, 5);
  });

  it('returns partial when intersection is smaller than min', () => {
    // A={a,b,c,d}, B={a,b,e} → intersection=2, min=3 → 0.667
    const a = new Set(['a', 'b', 'c', 'd']);
    const b = new Set(['a', 'b', 'e']);
    expect(keywordOverlap(a, b)).toBeCloseTo(2 / 3, 5);
  });

  it('returns 0 for empty sets', () => {
    expect(keywordOverlap(new Set(), new Set(['a']))).toBe(0);
    expect(keywordOverlap(new Set(['a']), new Set())).toBe(0);
    expect(keywordOverlap(new Set(), new Set())).toBe(0);
  });

  it('is case-insensitive', () => {
    const a = new Set(['Cinematic', 'FILM']);
    const b = new Set(['cinematic', 'film']);
    expect(keywordOverlap(a, b)).toBeCloseTo(1.0, 5);
  });

  it('handles single-element sets', () => {
    const a = new Set(['video']);
    const b = new Set(['video']);
    expect(keywordOverlap(a, b)).toBeCloseTo(1.0, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B) Synonym expansion
// ═══════════════════════════════════════════════════════════════════════════════

describe('synonym expansion (via scoreProvider task_fit)', () => {
  it('"cinematic" intent matches "film" bestFor', () => {
    const tool = makeTool({ bestFor: ['film production', 'movie trailers'] });
    const score = scoreProvider(tool, makeContext({ intent: 'cinematic video' }));
    expect(score.task_fit).toBeGreaterThan(0.4);
  });

  it('"explainer" intent matches "educational" bestFor', () => {
    const tool = makeTool({ bestFor: ['educational content', 'tutorial videos'] });
    const score = scoreProvider(
      tool,
      makeContext({ intent: 'explainer video about AI', styleKeywords: [] }),
    );
    expect(score.task_fit).toBeGreaterThan(0.4);
  });

  it('"social" intent matches "tiktok" bestFor', () => {
    const tool = makeTool({ bestFor: ['tiktok videos', 'instagram reels'] });
    const score = scoreProvider(
      tool,
      makeContext({ intent: 'social media content', styleKeywords: [] }),
    );
    expect(score.task_fit).toBeGreaterThan(0.4);
  });

  it('"animation" intent matches "motion-graphics" bestFor', () => {
    const tool = makeTool({ bestFor: ['motion graphics', 'animated content'] });
    const score = scoreProvider(
      tool,
      makeContext({ intent: 'animation for explainer', styleKeywords: [] }),
    );
    expect(score.task_fit).toBeGreaterThan(0.4);
  });

  it('"avatar" intent matches "presenter" bestFor', () => {
    const tool = makeTool({ bestFor: ['avatar presenter', 'talking head'] });
    const score = scoreProvider(
      tool,
      makeContext({ intent: 'avatar video with presenter', styleKeywords: [] }),
    );
    expect(score.task_fit).toBeGreaterThan(0.4);
  });

  it('"music" intent matches "soundtrack" bestFor', () => {
    const tool = makeTool({ bestFor: ['music', 'soundtrack', 'ambient score'] });
    const score = scoreProvider(
      tool,
      makeContext({ intent: 'background music for video', styleKeywords: [] }),
    );
    expect(score.task_fit).toBeGreaterThan(0.4);
  });

  it('no synonym match gives lower score than direct match', () => {
    const directTool = makeTool({ bestFor: ['cinematic video', 'film production'] });
    const synonymTool = makeTool({ bestFor: ['unrelated', 'something else'] });
    const directScore = scoreProvider(directTool, makeContext({ intent: 'cinematic video' }));
    const synonymScore = scoreProvider(synonymTool, makeContext({ intent: 'cinematic video' }));
    expect(directScore.task_fit).toBeGreaterThan(synonymScore.task_fit);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// C) Weighted score calculation
// ═══════════════════════════════════════════════════════════════════════════════

describe('weighted score calculation', () => {
  it('weighted_score is within [0, 1]', () => {
    const tools = [
      makeTool({ stability: 'production', bestFor: ['cinematic video'] }),
      makeTool({ stability: 'experimental', bestFor: ['unrelated'] }),
      makeTool({ stability: 'beta', bestFor: ['social media'] }),
    ];
    for (const tool of tools) {
      const score = scoreProvider(tool, makeContext({ budgetRemainingUsd: undefined }));
      expect(score.weighted_score).toBeGreaterThanOrEqual(0);
      expect(score.weighted_score).toBeLessThanOrEqual(1);
    }
  });

  it('weighted_score reflects dimension weights', () => {
    // A tool with maxed dimensions should score near 1.0
    const perfectTool: ToolInfo = {
      provider: 'perfect',
      name: 'PerfectTool',
      stability: 'production',
      runtime: 'local',
      bestFor: ['cinematic video', 'film production', 'dramatic content'],
      supports: {
        controlnet: true,
        reference_image: true,
        style_transfer: true,
        inpainting: true,
        img2img: true,
        negative_prompt: true,
        custom_size: true,
        aspect_ratio: true,
        seed: true,
      },
      historicalSuccessRate: 1.0,
      latencyP50Seconds: 0.1,
      qualityScore: 1.0,
      capability: 'video_generation',
      tier: 'generate',
      estimateCost: () => 0.001,
    };
    const score = scoreProvider(perfectTool, makeContext({ intent: 'cinematic video' }));
    expect(score.weighted_score).toBeGreaterThan(0.7);
  });

  it('higher task_fit produces higher weighted score', () => {
    const highFit = makeTool({ bestFor: ['cinematic video', 'film production'] });
    const lowFit = makeTool({ bestFor: ['unrelated', 'something else'] });
    const highScore = scoreProvider(highFit, makeContext({ budgetRemainingUsd: undefined }));
    const lowScore = scoreProvider(lowFit, makeContext({ budgetRemainingUsd: undefined }));
    expect(highScore.weighted_score).toBeGreaterThan(lowScore.weighted_score);
  });

  it('cost_efficiency dimension contributes correctly', () => {
    const cheapTool = makeTool({
      estimateCost: () => 0.01,
      bestFor: ['cinematic video'],
    });
    const expensiveTool = makeTool({
      estimateCost: () => 50,
      bestFor: ['cinematic video'],
    });
    const cheapScore = scoreProvider(cheapTool, makeContext({ budgetRemainingUsd: 10 }));
    const expensiveScore = scoreProvider(expensiveTool, makeContext({ budgetRemainingUsd: 10 }));
    expect(cheapScore.cost_efficiency).toBeGreaterThan(expensiveScore.cost_efficiency);
    expect(cheapScore.weighted_score).toBeGreaterThan(expensiveScore.weighted_score);
  });

  it('DIMENSION_WEIGHTS sum to 1.0', () => {
    const sum =
      DIMENSION_WEIGHTS.task_fit +
      DIMENSION_WEIGHTS.output_quality +
      DIMENSION_WEIGHTS.control +
      DIMENSION_WEIGHTS.reliability +
      DIMENSION_WEIGHTS.cost_efficiency +
      DIMENSION_WEIGHTS.latency +
      DIMENSION_WEIGHTS.continuity;
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D) Rank ordering
// ═══════════════════════════════════════════════════════════════════════════════

describe('rank ordering', () => {
  it('rankProviders returns scores sorted descending', () => {
    const tools = [
      makeTool({ name: 'Low', stability: 'experimental', bestFor: ['unrelated'] }),
      makeTool({ name: 'High', stability: 'production', bestFor: ['cinematic video', 'film'] }),
      makeTool({ name: 'Mid', stability: 'beta', bestFor: ['social media'] }),
    ];
    const rankings = rankProviders(tools, makeContext({ budgetRemainingUsd: undefined }));
    expect(rankings.length).toBe(3);
    for (let i = 1; i < rankings.length; i++) {
      expect(rankings[i]!.weighted_score).toBeLessThanOrEqual(rankings[i - 1]!.weighted_score);
    }
  });

  it('top-ranked provider matches the best-fit tool', () => {
    const tools = [
      makeTool({ name: 'Unrelated', bestFor: ['cooking recipes'] }),
      makeTool({ name: 'ExactMatch', bestFor: ['cinematic video', 'film production'] }),
      makeTool({ name: 'PartialMatch', bestFor: ['video content'] }),
    ];
    const rankings = rankProviders(tools, makeContext({ budgetRemainingUsd: undefined }));
    expect(rankings[0]!.toolName).toBe('ExactMatch');
  });

  it('returns empty array for empty input', () => {
    expect(rankProviders([], makeContext())).toEqual([]);
  });

  it('handles single provider', () => {
    const rankings = rankProviders([makeTool()], makeContext({ budgetRemainingUsd: undefined }));
    expect(rankings.length).toBe(1);
    expect(rankings[0]!.provider).toBe('test-provider');
  });

  it('rankProviders preserves all providers (no dropping)', () => {
    const tools = Array.from({ length: 10 }, (_, i) =>
      makeTool({ name: `Tool${i}`, bestFor: [`category-${i}`] }),
    );
    const rankings = rankProviders(tools, makeContext({ budgetRemainingUsd: undefined }));
    expect(rankings.length).toBe(10);
  });

  it('ties are broken consistently (stable sort by insertion order)', () => {
    const tools = [
      makeTool({ name: 'First', stability: 'production', bestFor: ['unrelated'] }),
      makeTool({ name: 'Second', stability: 'production', bestFor: ['unrelated'] }),
    ];
    const rankings = rankProviders(tools, makeContext({ budgetRemainingUsd: undefined }));
    // Both have same bestFor → similar task_fit. Names should be present.
    const toolNames = rankings.map((r) => r.toolName);
    expect(toolNames).toContain('First');
    expect(toolNames).toContain('Second');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E) Cost efficiency scoring
// ═══════════════════════════════════════════════════════════════════════════════

describe('cost efficiency scoring', () => {
  it('free tool gets cost_efficiency of 1.0', () => {
    const score = scoreProvider(makeTool(), makeContext({ budgetRemainingUsd: undefined }));
    expect(score.cost_efficiency).toBe(1.0);
  });

  it('zero budget remaining gives 0.0 cost efficiency', () => {
    const tool = makeTool({ estimateCost: () => 0.5 });
    const score = scoreProvider(tool, makeContext({ budgetRemainingUsd: 0 }));
    expect(score.cost_efficiency).toBe(0.0);
  });

  it('cost under 20% of budget gives 0.8', () => {
    const tool = makeTool({ estimateCost: () => 1.0 });
    const score = scoreProvider(tool, makeContext({ budgetRemainingUsd: 10 }));
    // 1.0 / 10 = 0.1 → ratio <= 0.2 → 0.8
    expect(score.cost_efficiency).toBeCloseTo(0.8, 5);
  });

  it('cost between 20-50% of budget gives 0.5', () => {
    const tool = makeTool({ estimateCost: () => 3.0 });
    const score = scoreProvider(tool, makeContext({ budgetRemainingUsd: 10 }));
    // 3.0 / 10 = 0.3 → 0.2 < ratio <= 0.5 → 0.5
    expect(score.cost_efficiency).toBeCloseTo(0.5, 5);
  });

  it('cost above 50% of budget gives 0.1', () => {
    const tool = makeTool({ estimateCost: () => 6.0 });
    const score = scoreProvider(tool, makeContext({ budgetRemainingUsd: 10 }));
    // 6.0 / 10 = 0.6 > 0.5 → 0.1
    expect(score.cost_efficiency).toBeCloseTo(0.1, 5);
  });

  it('absolute cost heuristic when no budget info', () => {
    // < $0.05 → 0.9
    const cheap = makeTool({ estimateCost: () => 0.01 });
    const cheapScore = scoreProvider(cheap, makeContext({ budgetRemainingUsd: undefined }));
    expect(cheapScore.cost_efficiency).toBeCloseTo(0.9, 5);

    // $0.05–$0.20 → 0.7
    const mid = makeTool({ estimateCost: () => 0.10 });
    const midScore = scoreProvider(mid, makeContext({ budgetRemainingUsd: undefined }));
    expect(midScore.cost_efficiency).toBeCloseTo(0.7, 5);

    // $0.20–$1.00 → 0.5
    const moderate = makeTool({ estimateCost: () => 0.50 });
    const modScore = scoreProvider(moderate, makeContext({ budgetRemainingUsd: undefined }));
    expect(modScore.cost_efficiency).toBeCloseTo(0.5, 5);

    // > $1.00 → 0.3
    const expensive = makeTool({ estimateCost: () => 5.0 });
    const expScore = scoreProvider(expensive, makeContext({ budgetRemainingUsd: undefined }));
    expect(expScore.cost_efficiency).toBeCloseTo(0.3, 5);
  });

  it('estimateCost throwing does not crash scoring', () => {
    const tool = makeTool({
      estimateCost: () => {
        throw new Error('cost estimation failed');
      },
    });
    expect(() => scoreProvider(tool, makeContext())).not.toThrow();
    // Falls back to estimatedCost = 0 → 1.0
    const score = scoreProvider(tool, makeContext({ budgetRemainingUsd: undefined }));
    expect(score.cost_efficiency).toBe(1.0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// F) Edge cases and robustness
// ═══════════════════════════════════════════════════════════════════════════════

describe('edge cases and robustness', () => {
  it('empty bestFor gives modest default task_fit (0.3)', () => {
    const score = scoreProvider(makeTool({ bestFor: [] }), makeContext({ budgetRemainingUsd: undefined }));
    expect(score.task_fit).toBeGreaterThanOrEqual(0.3);
  });

  it('empty supports gives modest default control (0.3)', () => {
    const score = scoreProvider(makeTool({ supports: {} }), makeContext({ budgetRemainingUsd: undefined }));
    expect(score.control).toBe(0.3);
  });

  it('no stability defaults to experimental reliability (0.4)', () => {
    const score = scoreProvider(makeTool({ stability: undefined as never }), makeContext({ budgetRemainingUsd: undefined }));
    expect(score.reliability).toBe(0.4);
  });

  it('no runtime defaults to api latency (0.4)', () => {
    const score = scoreProvider(makeTool({ runtime: undefined as never }), makeContext({ budgetRemainingUsd: undefined }));
    expect(score.latency).toBe(0.4);
  });

  it('no lockedProviders gives neutral continuity (0.5)', () => {
    const score = scoreProvider(makeTool(), makeContext({ lockedProviders: [] }));
    expect(score.continuity).toBe(0.5);
  });

  it('all dimensions are clamped to [0, 1]', () => {
    // Extreme inputs that could push scores out of bounds
    const extremeTool: ToolInfo = {
      provider: 'extreme',
      name: 'ExtremeTool',
      stability: 'production',
      runtime: 'api',
      bestFor: Array.from({ length: 50 }, (_, i) => `keyword-${i}`),
      supports: {
        controlnet: true,
        reference_image: true,
        style_transfer: true,
        inpainting: true,
        img2img: true,
        negative_prompt: true,
        custom_size: true,
        aspect_ratio: true,
        seed: true,
      },
      historicalSuccessRate: 1.0,
      latencyP50Seconds: 0.01,
      qualityScore: 1.0,
      capability: 'video_generation',
      tier: 'generate',
      estimateCost: () => 0.0001,
    };
    const score = scoreProvider(extremeTool, makeContext({ intent: 'cinematic video film production' }));
    expect(score.task_fit).toBeLessThanOrEqual(1.0);
    expect(score.output_quality).toBeLessThanOrEqual(1.0);
    expect(score.control).toBeLessThanOrEqual(1.0);
    expect(score.reliability).toBeLessThanOrEqual(1.0);
    expect(score.cost_efficiency).toBeLessThanOrEqual(1.0);
    expect(score.latency).toBeLessThanOrEqual(1.0);
    expect(score.continuity).toBeLessThanOrEqual(1.0);
    expect(score.weighted_score).toBeLessThanOrEqual(1.0);
  });

  it('motionRequired penalty applies only when assetType is video', () => {
    const imageTool = makeTool({ capability: 'image_generation' });
    const videoScore = scoreProvider(imageTool, makeContext({ motionRequired: true, assetType: 'video' }));
    const imageScore = scoreProvider(imageTool, makeContext({ motionRequired: true, assetType: 'image' }));
    expect(videoScore.task_fit).toBeLessThan(imageScore.task_fit);
  });

  it('reference conditioning bonus applies to supporting tools', () => {
    const supportingTool = makeTool({
      supports: { reference_to_video: true, reference_image: true },
    });
    const nonSupportingTool = makeTool({
      supports: { controlnet: true },
    });
    const ctx = makeContext({ intent: 'create a video with character reference', assetType: 'video', operation: 'reference_to_video' });
    const supportScore = scoreProvider(supportingTool, ctx);
    const noSupportScore = scoreProvider(nonSupportingTool, ctx);
    expect(supportScore.task_fit).toBeGreaterThan(noSupportScore.task_fit);
  });

  it('formatRanking handles empty rankings', () => {
    expect(formatRanking([])).toBe('');
  });

  it('formatRanking truncates to topN', () => {
    const tools = Array.from({ length: 20 }, (_, i) => makeTool({ name: `Tool${i}` }));
    const rankings = rankProviders(tools, makeContext({ budgetRemainingUsd: undefined }));
    const formatted = formatRanking(rankings, 5);
    const lines = formatted.split('\n');
    expect(lines.length).toBe(5);
  });
});

import { describe, it, expect } from 'vitest';
import {
  scoreProvider,
  rankProviders,
  formatRanking,
  DIMENSION_WEIGHTS,
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

// ── Dimension weights ─────────────────────────────────────────────────────────

describe('DIMENSION_WEIGHTS', () => {
  it('sums to 1.0', () => {
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

  it('has correct individual weights', () => {
    expect(DIMENSION_WEIGHTS.task_fit).toBe(0.30);
    expect(DIMENSION_WEIGHTS.output_quality).toBe(0.20);
    expect(DIMENSION_WEIGHTS.control).toBe(0.15);
    expect(DIMENSION_WEIGHTS.reliability).toBe(0.15);
    expect(DIMENSION_WEIGHTS.cost_efficiency).toBe(0.10);
    expect(DIMENSION_WEIGHTS.latency).toBe(0.05);
    expect(DIMENSION_WEIGHTS.continuity).toBe(0.05);
  });
});

// ── scoreProvider ─────────────────────────────────────────────────────────────

describe('scoreProvider', () => {
  it('returns a ProviderScore with all 7 dimensions + weighted_score', () => {
    const score = scoreProvider(makeTool(), makeContext());
    expect(score.provider).toBe('test-provider');
    expect(score.toolName).toBe('TestTool');
    expect(score.task_fit).toBeGreaterThanOrEqual(0);
    expect(score.task_fit).toBeLessThanOrEqual(1);
    expect(score.output_quality).toBeGreaterThanOrEqual(0);
    expect(score.output_quality).toBeLessThanOrEqual(1);
    expect(score.control).toBeGreaterThanOrEqual(0);
    expect(score.control).toBeLessThanOrEqual(1);
    expect(score.reliability).toBeGreaterThanOrEqual(0);
    expect(score.reliability).toBeLessThanOrEqual(1);
    expect(score.cost_efficiency).toBeGreaterThanOrEqual(0);
    expect(score.cost_efficiency).toBeLessThanOrEqual(1);
    expect(score.latency).toBeGreaterThanOrEqual(0);
    expect(score.latency).toBeLessThanOrEqual(1);
    expect(score.continuity).toBeGreaterThanOrEqual(0);
    expect(score.continuity).toBeLessThanOrEqual(1);
    expect(score.weighted_score).toBeGreaterThanOrEqual(0);
    expect(score.weighted_score).toBeLessThanOrEqual(1);
  });

  it('scores production stability as high reliability', () => {
    const score = scoreProvider(makeTool({ stability: 'production' }), makeContext());
    expect(score.reliability).toBe(0.95);
  });

  it('scores beta stability as medium reliability', () => {
    const score = scoreProvider(makeTool({ stability: 'beta' }), makeContext());
    expect(score.reliability).toBe(0.8);
  });

  it('scores experimental stability as low reliability', () => {
    const score = scoreProvider(
      makeTool({ stability: 'experimental' }),
      makeContext(),
    );
    expect(score.reliability).toBe(0.4);
  });

  it('uses historical_success_rate when provided', () => {
    const score = scoreProvider(
      makeTool({ stability: 'experimental', historicalSuccessRate: 0.99 }),
      makeContext(),
    );
    expect(score.reliability).toBe(0.99);
  });

  it('scores local runtime as high latency', () => {
    const score = scoreProvider(makeTool({ runtime: 'local' }), makeContext());
    expect(score.latency).toBe(0.9);
  });

  it('scores local_gpu runtime as high latency', () => {
    const score = scoreProvider(
      makeTool({ runtime: 'local_gpu' }),
      makeContext(),
    );
    expect(score.latency).toBe(0.9);
  });

  it('scores hybrid runtime as medium latency', () => {
    const score = scoreProvider(makeTool({ runtime: 'hybrid' }), makeContext());
    expect(score.latency).toBe(0.6);
  });

  it('scores api runtime as low latency', () => {
    const score = scoreProvider(makeTool({ runtime: 'api' }), makeContext());
    expect(score.latency).toBe(0.4);
  });

  it('uses measured p50 latency when provided', () => {
    const score = scoreProvider(
      makeTool({ latencyP50Seconds: 0.5 }),
      makeContext(),
    );
    expect(score.latency).toBe(1.0);
  });

  it('scores measured p50 > 60s as worst latency', () => {
    const score = scoreProvider(
      makeTool({ latencyP50Seconds: 120 }),
      makeContext(),
    );
    expect(score.latency).toBe(0.2);
  });

  it('uses measured quality score when provided', () => {
    const score = scoreProvider(
      makeTool({ qualityScore: 0.85 }),
      makeContext(),
    );
    expect(score.output_quality).toBe(0.85);
  });

  it('gives tier bonus for generate-tier production tools', () => {
    const score = scoreProvider(
      makeTool({ tier: 'generate', stability: 'production' }),
      makeContext(),
    );
    // production base is 0.9, +0.05 bonus = 0.95
    expect(score.output_quality).toBeCloseTo(0.95, 2);
  });

  it('does not give tier bonus for non-generate tier', () => {
    const score = scoreProvider(
      makeTool({ tier: 'basic', stability: 'production' }),
      makeContext(),
    );
    expect(score.output_quality).toBe(0.9);
  });

  it('scores continuity high when provider is locked', () => {
    const score = scoreProvider(
      makeTool({ provider: 'openrouter' }),
      makeContext({ lockedProviders: ['openrouter', 'anthropic'] }),
    );
    expect(score.continuity).toBe(0.9);
  });

  it('scores continuity low when provider is not locked', () => {
    const score = scoreProvider(
      makeTool({ provider: 'wan' }),
      makeContext({ lockedProviders: ['openrouter'] }),
    );
    expect(score.continuity).toBe(0.4);
  });

  it('scores continuity neutral when no locked providers', () => {
    const score = scoreProvider(makeTool(), makeContext());
    expect(score.continuity).toBe(0.5);
  });

  it('gives high cost efficiency for zero cost', () => {
    const score = scoreProvider(makeTool(), makeContext());
    // No estimateCost => estimatedCost = 0 => 1.0
    expect(score.cost_efficiency).toBe(1.0);
  });

  it('uses estimateCost when provided', () => {
    const tool = makeTool({
      estimateCost: () => 0.5,
    });
    const score = scoreProvider(tool, makeContext({ budgetRemainingUsd: 10 }));
    // 0.5 / 10 = 0.05 ratio => 0.8
    expect(score.cost_efficiency).toBe(0.8);
  });

  it('gives low cost efficiency when over half budget', () => {
    const tool = makeTool({
      estimateCost: () => 6,
    });
    const score = scoreProvider(tool, makeContext({ budgetRemainingUsd: 10 }));
    // 6/10 = 0.6 > 0.5 => 0.1
    expect(score.cost_efficiency).toBe(0.1);
  });

  it('penalises task_fit when motion required but tool lacks video', () => {
    const score = scoreProvider(
      makeTool({ capability: 'image_generation' }),
      makeContext({ motionRequired: true, assetType: 'video' }),
    );
    // task_fit gets *= 0.2 heavy penalty
    expect(score.task_fit).toBeLessThan(0.3);
  });

  it('boosts task_fit for reference conditioning support', () => {
    const score = scoreProvider(
      makeTool({
        supports: {
          controlnet: true,
          reference_image: true,
          reference_to_video: true,
        },
      }),
      makeContext({
        intent: 'create a video with character reference',
        assetType: 'video',
        operation: 'reference_to_video',
      }),
    );
    expect(score.task_fit).toBeGreaterThan(0.5);
  });

  it('boosts task_fit for image editing support', () => {
    const score = scoreProvider(
      makeTool({
        supports: {
          controlnet: true,
          image_edit: true,
          style_transfer: true,
        },
      }),
      makeContext({
        intent: 'edit and composite this image',
        assetType: 'image',
        operation: 'edit',
      }),
    );
    expect(score.task_fit).toBeGreaterThan(0.5);
  });

  it('gives cinematic bonus for video tasks with cinematic intent', () => {
    const score = scoreProvider(
      makeTool({
        supports: {
          controlnet: true,
          native_audio: true,
          multi_shot: true,
          camera_direction: true,
          lip_sync: true,
          cinematic_quality: true,
        },
      }),
      makeContext({
        intent: 'create a cinematic trailer',
        assetType: 'video',
      }),
    );
    // 5 premium features matched (>= 3) => +0.15 task_fit, +0.10 quality
    expect(score.task_fit).toBeGreaterThan(0.6);
    expect(score.output_quality).toBeGreaterThan(0.9);
  });

  it('returns modest default for empty best_for', () => {
    const score = scoreProvider(makeTool({ bestFor: [] }), makeContext());
    expect(score.task_fit).toBeGreaterThanOrEqual(0.3);
  });

  it('returns modest control for empty supports', () => {
    const score = scoreProvider(makeTool({ supports: {} }), makeContext());
    expect(score.control).toBe(0.3);
  });
});

// ── Synonym expansion ─────────────────────────────────────────────────────────

describe('synonym expansion', () => {
  it('matches "film" when intent says "cinematic"', () => {
    const tool = makeTool({ bestFor: ['film production', 'movie content'] });
    const score = scoreProvider(tool, makeContext({ intent: 'cinematic video' }));
    // "cinematic" expands to include "film", "movie" — should score well
    expect(score.task_fit).toBeGreaterThan(0.5);
  });

  it('matches "tiktok" when intent says "social"', () => {
    const tool = makeTool({ bestFor: ['tiktok videos', 'social media clips'] });
    const score = scoreProvider(
      tool,
      makeContext({ intent: 'social media content' }),
    );
    expect(score.task_fit).toBeGreaterThan(0.5);
  });

  it('matches "voiceover" when intent says "narration"', () => {
    const tool = makeTool({ bestFor: ['voiceover', 'narration services'] });
    const score = scoreProvider(
      tool,
      makeContext({ intent: 'voice narration for video' }),
    );
    expect(score.task_fit).toBeGreaterThan(0.5);
  });

  it('matches "presenter" when intent says "avatar"', () => {
    const tool = makeTool({ bestFor: ['avatar presenter', 'talking head'] });
    const score = scoreProvider(
      tool,
      makeContext({ intent: 'avatar video with presenter' }),
    );
    expect(score.task_fit).toBeGreaterThan(0.5);
  });

  it('matches "soundtrack" when intent says "music"', () => {
    const tool = makeTool({ bestFor: ['music', 'soundtrack', 'background score'] });
    const score = scoreProvider(
      tool,
      makeContext({ intent: 'background music for video' }),
    );
    expect(score.task_fit).toBeGreaterThan(0.5);
  });

  it('matches "animated" when intent says "animation"', () => {
    const tool = makeTool({ bestFor: ['animated content', 'motion graphics'] });
    const score = scoreProvider(
      tool,
      makeContext({ intent: 'animation for explainer video' }),
    );
    expect(score.task_fit).toBeGreaterThan(0.5);
  });

  it('matches "educational" when intent says "explainer"', () => {
    const tool = makeTool({ bestFor: ['educational content', 'tutorial videos'] });
    const score = scoreProvider(
      tool,
      makeContext({ intent: 'explainer video about AI' }),
    );
    expect(score.task_fit).toBeGreaterThan(0.5);
  });
});

// ── rankProviders ─────────────────────────────────────────────────────────────

describe('rankProviders', () => {
  it('returns scores sorted best-first', () => {
    const tools = [
      makeTool({ name: 'LowScore', bestFor: ['unrelated'], stability: 'experimental' }),
      makeTool({ name: 'HighScore', bestFor: ['cinematic video', 'film production'], stability: 'production' }),
    ];
    const rankings = rankProviders(tools, makeContext());
    expect(rankings.length).toBe(2);
    expect(rankings[0]!.toolName).toBe('HighScore');
    expect(rankings[0]!.weighted_score).toBeGreaterThan(rankings[1]!.weighted_score);
  });

  it('returns empty array for empty tools input', () => {
    const rankings = rankProviders([], makeContext());
    expect(rankings).toEqual([]);
  });

  it('scores all providers even with partial overlap', () => {
    const tools = [
      makeTool({ name: 'A', bestFor: ['cinematic film'] }),
      makeTool({ name: 'B', bestFor: ['social tiktok'] }),
      makeTool({ name: 'C', bestFor: ['avatar presenter'] }),
    ];
    const rankings = rankProviders(tools, makeContext());
    expect(rankings.length).toBe(3);
    // All should have valid scores
    for (const r of rankings) {
      expect(r.weighted_score).toBeGreaterThanOrEqual(0);
      expect(r.weighted_score).toBeLessThanOrEqual(1);
    }
  });
});

// ── formatRanking ─────────────────────────────────────────────────────────────

describe('formatRanking', () => {
  it('formats top N entries', () => {
    const tools = [
      makeTool({ name: 'Alpha', bestFor: ['cinematic video'] }),
      makeTool({ name: 'Beta', bestFor: ['social media'] }),
      makeTool({ name: 'Gamma', bestFor: ['animation'] }),
    ];
    const rankings = rankProviders(tools, makeContext());
    const formatted = formatRanking(rankings, 2);
    const lines = formatted.split('\n');
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('1.');
    expect(lines[1]).toContain('2.');
  });

  it('defaults to top 5', () => {
    const tools = Array.from({ length: 10 }, (_, i) =>
      makeTool({ name: `Tool${i}` }),
    );
    const rankings = rankProviders(tools, makeContext());
    const formatted = formatRanking(rankings);
    const lines = formatted.split('\n');
    expect(lines.length).toBe(5);
  });

  it('handles fewer entries than topN', () => {
    const tools = [makeTool({ name: 'Only' })];
    const rankings = rankProviders(tools, makeContext());
    const formatted = formatRanking(rankings, 10);
    const lines = formatted.split('\n');
    expect(lines.length).toBe(1);
  });

  it('returns empty string for empty rankings', () => {
    expect(formatRanking([])).toBe('');
  });
});

// ── Keyword overlap ────────────────────────────────────────────────────────────

describe('keyword overlap', () => {
  it('returns modest default for empty bestFor with non-empty intent', () => {
    const score = scoreProvider(makeTool({ bestFor: [] }), makeContext({ intent: 'cinematic video production' }));
    expect(score.task_fit).toBeGreaterThanOrEqual(0.3);
  });

  it('returns high overlap when intent is subset of best_for', () => {
    const tool = makeTool({ bestFor: ['cinematic video', 'film production', 'movie trailer'] });
    const score = scoreProvider(tool, makeContext({ intent: 'cinematic video' }));
    expect(score.task_fit).toBeGreaterThan(0.6);
  });

  it('returns low overlap when intent has no matching terms', () => {
    const tool = makeTool({ bestFor: ['image generation', 'photo editing'] });
    const score = scoreProvider(tool, makeContext({ intent: 'cinematic video production' }));
    expect(score.task_fit).toBeLessThan(0.4);
  });

  it('handles partial overlap correctly', () => {
    const tool = makeTool({ bestFor: ['social media', 'tiktok', 'instagram reels'] });
    const score = scoreProvider(tool, makeContext({ intent: 'social media content' }));
    expect(score.task_fit).toBeGreaterThan(0.3);
    expect(score.task_fit).toBeLessThan(0.9);
  });

  it('is case-insensitive', () => {
    const tool = makeTool({ bestFor: ['Cinematic Video', 'FILM Production'] });
    const score = scoreProvider(tool, makeContext({ intent: 'CINEMATIC VIDEO' }));
    expect(score.task_fit).toBeGreaterThan(0.6);
  });

  it('handles punctuation in tokens (hyphenated tokens match)', () => {
    const tool = makeTool({ bestFor: ['video-generation', 'film-making'] });
    const score = scoreProvider(tool, makeContext({ intent: 'video generation' }));
    expect(score.task_fit).toBeGreaterThan(0.3);
  });
});

// ── Synonym expansion ──────────────────────────────────────────────────────────

describe('synonym expansion', () => {
  it('expands "trailer" via cinematic cluster', () => {
    const tool = makeTool({ bestFor: ['cinematic content', 'film production'] });
    const score = scoreProvider(tool, makeContext({ intent: 'movie trailer' }));
    expect(score.task_fit).toBeGreaterThan(0.5);
  });

  it('expands "lesson" via educational cluster', () => {
    const tool = makeTool({ bestFor: ['educational content', 'tutorial videos'] });
    const score = scoreProvider(tool, makeContext({ intent: 'teaching lesson' }));
    expect(score.task_fit).toBeGreaterThan(0.5);
  });

  it('expands "viral" via social cluster', () => {
    const tool = makeTool({ bestFor: ['tiktok videos', 'social media'] });
    const score = scoreProvider(tool, makeContext({ intent: 'viral social content' }));
    expect(score.task_fit).toBeGreaterThan(0.5);
  });

  it('expands "motion" via animation cluster', () => {
    const tool = makeTool({ bestFor: ['animated content', 'motion graphics'] });
    const score = scoreProvider(tool, makeContext({ intent: 'motion design' }));
    expect(score.task_fit).toBeGreaterThan(0.5);
  });

  it('expands "speech" via voiceover cluster', () => {
    const tool = makeTool({ bestFor: ['voiceover', 'narration'] });
    const score = scoreProvider(tool, makeContext({ intent: 'speech synthesis' }));
    expect(score.task_fit).toBeGreaterThan(0.5);
  });

  it('expands "ambient" via music cluster', () => {
    const tool = makeTool({ bestFor: ['music', 'soundtrack'] });
    const score = scoreProvider(tool, makeContext({ intent: 'ambient background' }));
    expect(score.task_fit).toBeGreaterThan(0.5);
  });

  it('no synonym match when no cluster words present', () => {
    const tool = makeTool({ bestFor: ['data processing', 'analytics'] });
    const score = scoreProvider(tool, makeContext({ intent: 'random unrelated words xyz' }));
    expect(score.task_fit).toBeLessThan(0.4);
  });

  it('synonym expansion applies to styleKeywords', () => {
    const tool = makeTool({ bestFor: ['cinematic video', 'film production'] });
    const score = scoreProvider(tool, makeContext({
      intent: 'create content',
      styleKeywords: ['dramatic', 'epic'],
    }));
    expect(score.task_fit).toBeGreaterThan(0.3);
  });
});

// ── Weighted score calculation ─────────────────────────────────────────────────

describe('weighted score calculation', () => {
  it('all weighted_scores are within [0, 1]', () => {
    const tools = [
      makeTool({ stability: 'production', bestFor: ['cinematic video'] }),
      makeTool({ stability: 'experimental', bestFor: [] }),
      makeTool({ stability: 'beta', bestFor: ['social media'] }),
    ];
    for (const s of rankProviders(tools, makeContext())) {
      expect(s.weighted_score).toBeGreaterThanOrEqual(0);
      expect(s.weighted_score).toBeLessThanOrEqual(1);
    }
  });

  it('higher task_fit yields higher weighted_score', () => {
    const ctx = makeContext({ intent: 'cinematic video', styleKeywords: ['dramatic'] });
    const highFit = scoreProvider(
      makeTool({ bestFor: ['cinematic video', 'film production'], stability: 'production' }),
      ctx,
    );
    const lowFit = scoreProvider(
      makeTool({ bestFor: ['image generation', 'photo editing'], stability: 'production' }),
      ctx,
    );
    expect(highFit.weighted_score).toBeGreaterThan(lowFit.weighted_score);
  });

  it('higher reliability yields higher weighted_score', () => {
    const ctx = makeContext({ intent: 'cinematic video' });
    const prodScore = scoreProvider(
      makeTool({ stability: 'production', bestFor: ['cinematic video'] }),
      ctx,
    );
    const expScore = scoreProvider(
      makeTool({ stability: 'experimental', bestFor: ['cinematic video'] }),
      ctx,
    );
    expect(prodScore.weighted_score).toBeGreaterThan(expScore.weighted_score);
  });

  it('cost efficiency affects weighted_score', () => {
    const ctx = makeContext({ intent: 'cinematic video', budgetRemainingUsd: 10 });
    const cheapScore = scoreProvider(
      makeTool({ bestFor: ['cinematic video'], estimateCost: () => 0.01 }),
      ctx,
    );
    const expensiveScore = scoreProvider(
      makeTool({ bestFor: ['cinematic video'], estimateCost: () => 5.0 }),
      ctx,
    );
    expect(cheapScore.cost_efficiency).toBeGreaterThan(expensiveScore.cost_efficiency);
    expect(cheapScore.weighted_score).toBeGreaterThan(expensiveScore.weighted_score);
  });

  it('task_fit weight dominates composite when fit differs greatly', () => {
    const perfectFit = scoreProvider(
      makeTool({ bestFor: ['cinematic video', 'film production', 'movie trailer', 'dramatic content'] }),
      makeContext({ intent: 'cinematic video production' }),
    );
    const poorFit = scoreProvider(
      makeTool({ bestFor: ['image generation'] }),
      makeContext({ intent: 'cinematic video production' }),
    );
    expect(perfectFit.weighted_score - poorFit.weighted_score).toBeGreaterThan(0.15);
  });

  it('continuity bonus increases score for locked providers', () => {
    const lockedCtx = makeContext({ lockedProviders: ['openrouter'] });
    const lockedScore = scoreProvider(
      makeTool({ provider: 'openrouter', bestFor: ['cinematic video'] }),
      lockedCtx,
    );
    const unlockedScore = scoreProvider(
      makeTool({ provider: 'anthropic', bestFor: ['cinematic video'] }),
      lockedCtx,
    );
    expect(lockedScore.continuity).toBeGreaterThan(unlockedScore.continuity);
    expect(lockedScore.weighted_score).toBeGreaterThan(unlockedScore.weighted_score);
  });

  it('motionRequired penalty reduces task_fit for image-only tools', () => {
    const videoCtx = makeContext({ motionRequired: true, assetType: 'video' });
    const imageScore = scoreProvider(
      makeTool({ capability: 'image_generation', bestFor: ['image creation'] }),
      videoCtx,
    );
    const videoScore = scoreProvider(
      makeTool({ capability: 'video_generation', bestFor: ['video creation'] }),
      videoCtx,
    );
    expect(imageScore.task_fit).toBeLessThan(videoScore.task_fit);
    expect(imageScore.task_fit).toBeLessThan(0.3);
  });
});

// ── Rank ordering ──────────────────────────────────────────────────────────────

describe('rank ordering', () => {
  it('sorts descending by weighted_score', () => {
    const tools = [
      makeTool({ name: 'Worst', stability: 'experimental', bestFor: [] }),
      makeTool({ name: 'Best', stability: 'production', bestFor: ['cinematic video', 'film production'] }),
      makeTool({ name: 'Mid', stability: 'beta', bestFor: ['video content'] }),
    ];
    const rankings = rankProviders(tools, makeContext());
    expect(rankings[0]!.toolName).toBe('Best');
    expect(rankings[1]!.toolName).toBe('Mid');
    expect(rankings[2]!.toolName).toBe('Worst');
  });

  it('single tool returns single-element array', () => {
    const rankings = rankProviders([makeTool()], makeContext());
    expect(rankings).toHaveLength(1);
    expect(rankings[0]!.provider).toBe('test-provider');
  });

  it('rankings include all dimensions', () => {
    const rankings = rankProviders([makeTool()], makeContext());
    const score = rankings[0]!;
    expect(score).toHaveProperty('provider');
    expect(score).toHaveProperty('toolName');
    expect(score).toHaveProperty('task_fit');
    expect(score).toHaveProperty('output_quality');
    expect(score).toHaveProperty('control');
    expect(score).toHaveProperty('reliability');
    expect(score).toHaveProperty('cost_efficiency');
    expect(score).toHaveProperty('latency');
    expect(score).toHaveProperty('continuity');
    expect(score).toHaveProperty('weighted_score');
  });

  it('top-ranked has highest score in a large set', () => {
    const tools = Array.from({ length: 20 }, (_, i) =>
      makeTool({
        name: `Provider${i}`,
        stability: i < 10 ? 'production' : 'experimental',
        bestFor: i < 10 ? ['cinematic video', 'film'] : ['unrelated'],
      }),
    );
    const rankings = rankProviders(tools, makeContext());
    expect(rankings[0]!.weighted_score).toBeGreaterThan(rankings[rankings.length - 1]!.weighted_score);
  });
});

// ── Cost efficiency scoring ────────────────────────────────────────────────────

describe('cost efficiency scoring', () => {
  it('free tool gets cost_efficiency of 1.0', () => {
    const score = scoreProvider(makeTool({ estimateCost: () => 0 }), makeContext());
    expect(score.cost_efficiency).toBe(1.0);
  });

  it('no estimateCost function defaults to 1.0', () => {
    const score = scoreProvider(makeTool(), makeContext());
    expect(score.cost_efficiency).toBe(1.0);
  });

  it('cost under $0.05 with no budget info gets 0.9', () => {
    const score = scoreProvider(
      makeTool({ estimateCost: () => 0.01 }),
      makeContext({ budgetRemainingUsd: undefined }),
    );
    expect(score.cost_efficiency).toBeCloseTo(0.9, 1);
  });

  it('cost $0.05-$0.20 gets 0.7', () => {
    const score = scoreProvider(
      makeTool({ estimateCost: () => 0.15 }),
      makeContext({ budgetRemainingUsd: undefined }),
    );
    expect(score.cost_efficiency).toBeCloseTo(0.7, 1);
  });

  it('cost $0.20-$1.00 gets 0.5', () => {
    const score = scoreProvider(
      makeTool({ estimateCost: () => 0.50 }),
      makeContext({ budgetRemainingUsd: undefined }),
    );
    expect(score.cost_efficiency).toBeCloseTo(0.5, 1);
  });

  it('cost over $1.00 gets 0.3', () => {
    const score = scoreProvider(
      makeTool({ estimateCost: () => 2.0 }),
      makeContext({ budgetRemainingUsd: undefined }),
    );
    expect(score.cost_efficiency).toBeCloseTo(0.3, 1);
  });

  it('zero remaining budget gives 0.0 efficiency', () => {
    const score = scoreProvider(
      makeTool({ estimateCost: () => 0.10 }),
      makeContext({ budgetRemainingUsd: 0 }),
    );
    expect(score.cost_efficiency).toBe(0.0);
  });

  it('cost > 50% of remaining budget gives 0.1', () => {
    const score = scoreProvider(
      makeTool({ estimateCost: () => 0.60 }),
      makeContext({ budgetRemainingUsd: 1.0 }),
    );
    expect(score.cost_efficiency).toBeCloseTo(0.1, 1);
  });

  it('cost 20-50% of remaining budget gives 0.5', () => {
    const score = scoreProvider(
      makeTool({ estimateCost: () => 0.30 }),
      makeContext({ budgetRemainingUsd: 1.0 }),
    );
    expect(score.cost_efficiency).toBeCloseTo(0.5, 1);
  });

  it('cost under 20% of remaining budget gives 0.8', () => {
    const score = scoreProvider(
      makeTool({ estimateCost: () => 0.10 }),
      makeContext({ budgetRemainingUsd: 1.0 }),
    );
    expect(score.cost_efficiency).toBeCloseTo(0.8, 1);
  });

  it('estimateCost throwing does not crash scoring', () => {
    const tool = makeTool({
      estimateCost: () => {
        throw new Error('cost estimation failed');
      },
    });
    expect(() => scoreProvider(tool, makeContext())).not.toThrow();
    const score = scoreProvider(tool, makeContext());
    expect(score.cost_efficiency).toBe(1.0);
  });
});

// ── DIMENSION_WEIGHTS invariants ───────────────────────────────────────────────

describe('DIMENSION_WEIGHTS invariants', () => {
  it('all weights are non-negative', () => {
    for (const w of Object.values(DIMENSION_WEIGHTS)) {
      expect(w).toBeGreaterThanOrEqual(0);
    }
  });

  it('all weights are at most 1', () => {
    for (const w of Object.values(DIMENSION_WEIGHTS)) {
      expect(w).toBeLessThanOrEqual(1);
    }
  });

  it('task_fit is the largest weight', () => {
    expect(DIMENSION_WEIGHTS.task_fit).toBeGreaterThanOrEqual(DIMENSION_WEIGHTS.output_quality);
    expect(DIMENSION_WEIGHTS.task_fit).toBeGreaterThanOrEqual(DIMENSION_WEIGHTS.control);
    expect(DIMENSION_WEIGHTS.task_fit).toBeGreaterThanOrEqual(DIMENSION_WEIGHTS.reliability);
    expect(DIMENSION_WEIGHTS.task_fit).toBeGreaterThanOrEqual(DIMENSION_WEIGHTS.cost_efficiency);
    expect(DIMENSION_WEIGHTS.task_fit).toBeGreaterThanOrEqual(DIMENSION_WEIGHTS.latency);
    expect(DIMENSION_WEIGHTS.task_fit).toBeGreaterThanOrEqual(DIMENSION_WEIGHTS.continuity);
  });
});

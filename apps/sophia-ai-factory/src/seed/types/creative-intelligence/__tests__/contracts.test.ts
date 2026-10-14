/**
 * Creative Intelligence Contracts & Validation Unit Tests
 *
 * Layer: seed/types/creative-intelligence
 */

import { describe, expect, it } from 'vitest';
import {
  HookEvaluationInputSchema,
  HookScoreResultSchema,
  HookStyleSchema,
  PatternUpdateResultSchema,
  TrendingPlatformSchema,
  TrendingSignalSchema,
  validateOptimizeResponse,
  validateReasoningResponse,
  VideoEngagementFeedbackSchema,
} from '../index';

describe('Creative Intelligence Contract Specifications', () => {
  it('validates CreativeReasoningResponse successfully', () => {
    const raw = {
      concept: 'AI Factory Launch Concept',
      rationale: 'Deep resonance with agency founders',
      audienceFit: 'B2B CEOs & Creative Directors',
      riskFactors: ['High execution cost', 'API rate limiting'],
      alternatives: ['Low-fi UGC variant'],
    };
    const res = validateReasoningResponse(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.concept).toBe('AI Factory Launch Concept');
      expect(res.value.riskFactors).toHaveLength(2);
    }
  });

  it('rejects invalid CreativeReasoningResponse', () => {
    const raw = {
      concept: '',
      rationale: 'Missing fields',
    };
    const res = validateReasoningResponse(raw);
    expect(res.ok).toBe(false);
  });

  it('validates PromptOptimizeResponse successfully', () => {
    const raw = {
      optimizedPrompt: 'Cinematic hyper-realistic establishing shot...',
      changes: ['Enhanced lighting description', 'Added camera dolly move'],
      confidence: 0.95,
    };
    const res = validateOptimizeResponse(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.confidence).toBe(0.95);
      expect(res.value.changes).toHaveLength(2);
    }
  });

  it('validates HookEvaluation and HookScore schemas', () => {
    expect(HookStyleSchema.safeParse('bold_claim').success).toBe(true);
    expect(HookStyleSchema.safeParse('invalid_style').success).toBe(false);

    const hookInput = {
      hookText: 'Stop paying agencies $10,000/month for simple videos.',
      hookStyle: 'bold_claim',
    };
    expect(HookEvaluationInputSchema.safeParse(hookInput).success).toBe(true);

    const scoreResult = {
      viralScore: 0.88,
      hookScore: 0.92,
      pacingScore: 0.85,
      retentionScore: 0.89,
      ctaScore: 0.82,
      detectedHookStyle: 'bold_claim',
      weights: { hook: 0.4, pacing: 0.25, retention: 0.2, cta: 0.15 },
    };
    expect(HookScoreResultSchema.safeParse(scoreResult).success).toBe(true);
  });

  it('validates TrendingSignal and VideoEngagementFeedback schemas', () => {
    expect(TrendingPlatformSchema.safeParse('tiktok').success).toBe(true);
    expect(TrendingPlatformSchema.safeParse('linkedin').success).toBe(false);

    const signal = {
      id: 'trend_123',
      platform: 'tiktok',
      topic: 'AI Automation',
      query: 'ai workflows',
      title: 'How to automate video production in 2026',
      engagementMetrics: { viewCount: 50000 },
      velocityScore: 1.45,
      momentumScore: 0.92,
      hashtags: ['#ai', '#agency'],
      detectedAt: Date.now(),
    };
    expect(TrendingSignalSchema.safeParse(signal).success).toBe(true);

    const feedback = {
      videoId: 'vid_001',
      platform: 'tiktok',
      views: 12000,
      shares: 450,
      watchTimeSeconds: 28000,
      completionRate: 0.65,
    };
    expect(VideoEngagementFeedbackSchema.safeParse(feedback).success).toBe(true);

    const updateRes = {
      confidence: 0.85,
      confidenceLevel: 'high',
      newScore: 78.4,
    };
    expect(PatternUpdateResultSchema.safeParse(updateRes).success).toBe(true);
  });
});

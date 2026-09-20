/**
 * @module seed/types/creative-intelligence
 *
 * Creative intelligence contracts for Hermes.
 *
 * Stable schemas for `creative.reason` and `creative.prompt.optimize`.
 * Uses existing Sophia types + Zod + Result pattern.
 *
 * Invalid model output returns typed Result failure — never crashes.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import { z } from 'zod';
import { success, failure, type Result } from './result';

// ── Creative Reasoning ────────────────────────────────────────────────────────

/** Request to generate creative reasoning for a brief. */
export interface CreativeReasoningRequest {
  brief: string;
  context?: string;
  model?: string;
  constraints?: string[];
}

/** Zod schema for CreativeReasoningRequest. */
export const CreativeReasoningRequestSchema = z.object({
  brief: z.string().min(1, 'brief is required'),
  context: z.string().optional(),
  model: z.string().optional(),
  constraints: z.array(z.string()).optional(),
});

/** Response containing structured creative reasoning. */
export interface CreativeReasoningResponse {
  concept: string;
  rationale: string;
  audienceFit: string;
  riskFactors: string[];
  alternatives: string[];
}

/** Zod schema for CreativeReasoningResponse. */
export const CreativeReasoningResponseSchema = z.object({
  concept: z.string().min(1, 'concept is required'),
  rationale: z.string().min(1, 'rationale is required'),
  audienceFit: z.string().min(1, 'audienceFit is required'),
  riskFactors: z.array(z.string()),
  alternatives: z.array(z.string()),
});

// ── Prompt Optimization ───────────────────────────────────────────────────────

/** Request to optimize a prompt for a target platform. */
export interface PromptOptimizeRequest {
  originalPrompt: string;
  targetPlatform?: string;
  style?: string;
}

/** Zod schema for PromptOptimizeRequest. */
export const PromptOptimizeRequestSchema = z.object({
  originalPrompt: z.string().min(1, 'originalPrompt is required'),
  targetPlatform: z.string().optional(),
  style: z.string().optional(),
});

/** Response containing an optimized prompt. */
export interface PromptOptimizeResponse {
  optimizedPrompt: string;
  changes: string[];
  confidence: number;
}

/** Zod schema for PromptOptimizeResponse. */
export const PromptOptimizeResponseSchema = z.object({
  optimizedPrompt: z.string().min(1, 'optimizedPrompt is required'),
  changes: z.array(z.string()),
  confidence: z.number().min(0).max(1, 'confidence must be between 0 and 1'),
});

// ── Validation helpers ────────────────────────────────────────────────────────

/**
 * Validate a raw model output against the CreativeReasoningResponse schema.
 *
 * @param raw — Raw JSON from the model (unknown shape).
 * @returns Result with validated response or descriptive error string.
 */
export function validateReasoningResponse(
  raw: unknown,
): Result<CreativeReasoningResponse, string> {
  const parsed = CreativeReasoningResponseSchema.safeParse(raw);
  if (parsed.success) {
    return success(parsed.data);
  }
  const message = parsed.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  return failure(`Invalid creative reasoning response: ${message}`);
}

/**
 * Validate a raw model output against the PromptOptimizeResponse schema.
 *
 * @param raw — Raw JSON from the model (unknown shape).
 * @returns Result with validated response or descriptive error string.
 */
export function validateOptimizeResponse(
  raw: unknown,
): Result<PromptOptimizeResponse, string> {
  const parsed = PromptOptimizeResponseSchema.safeParse(raw);
  if (parsed.success) {
    return success(parsed.data);
  }
  const message = parsed.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  return failure(`Invalid prompt optimization response: ${message}`);
}

// ── Hook Scoring & Evaluation Contracts ───────────────────────────────────────

/** Canonical 6 hook style classifications */
export const HookStyleSchema = z.enum([
  'curiosity_gap',
  'bold_claim',
  'problem_agitation',
  'question',
  'story_lead',
  'statistic_reveal',
]);
export type HookStyle = z.infer<typeof HookStyleSchema>;

/** Input payload for evaluating a video script hook */
export const HookEvaluationInputSchema = z.object({
  hookText: z.string().min(1, 'hookText is required'),
  hookStyle: HookStyleSchema.optional(),
  transcriptText: z.string().optional(),
  scores: z
    .object({
      hookScore: z.number().min(0).max(1).optional(),
      pacingScore: z.number().min(0).max(1).optional(),
      retentionScore: z.number().min(0).max(1).optional(),
      ctaScore: z.number().min(0).max(1).optional(),
    })
    .optional(),
});
export type HookEvaluationInput = z.infer<typeof HookEvaluationInputSchema>;

/** Output result of viral hook scoring calculation */
export const HookScoreResultSchema = z.object({
  viralScore: z.number().min(0).max(1),
  hookScore: z.number().min(0).max(1),
  pacingScore: z.number().min(0).max(1),
  retentionScore: z.number().min(0).max(1),
  ctaScore: z.number().min(0).max(1),
  detectedHookStyle: HookStyleSchema,
  weights: z.object({
    hook: z.literal(0.4),
    pacing: z.literal(0.25),
    retention: z.literal(0.2),
    cta: z.literal(0.15),
  }),
  reasoning: z.string().optional(),
});
export type HookScoreResult = z.infer<typeof HookScoreResultSchema>;

// ── Cross-Platform Trending Signal Contracts ─────────────────────────────────

export const TrendingPlatformSchema = z.enum(['tiktok', 'youtube_shorts', 'x']);
export type TrendingPlatform = z.infer<typeof TrendingPlatformSchema>;

export const TrendingSignalSchema = z.object({
  id: z.string(),
  platform: TrendingPlatformSchema,
  topic: z.string(),
  query: z.string(),
  title: z.string(),
  engagementMetrics: z.object({
    viewCount: z.number().optional(),
    likeCount: z.number().optional(),
    shareCount: z.number().optional(),
    commentCount: z.number().optional(),
    volume: z.number().optional(),
  }),
  velocityScore: z.number(),
  momentumScore: z.number(),
  viralScore: z.number().optional(),
  hashtags: z.array(z.string()),
  detectedAt: z.number(),
  rawData: z.record(z.string(), z.unknown()).optional(),
});
export type TrendingSignal = z.infer<typeof TrendingSignalSchema>;

// ── Closed-Loop Viral Feedback Contracts ─────────────────────────────────────

export const VideoEngagementFeedbackSchema = z.object({
  videoId: z.string().min(1, 'videoId is required'),
  workspaceId: z.string().optional(),
  missionId: z.string().optional(),
  platform: z.enum(['tiktok', 'youtube_shorts', 'x', 'instagram_reels']).or(z.string()),
  hookStyle: HookStyleSchema.optional(),
  voiceStyle: z.string().optional(),
  durationSeconds: z.number().positive().optional(),
  totalDurationSeconds: z.number().positive().optional(),
  views: z.number().nonnegative().optional(),
  shares: z.number().nonnegative().optional(),
  watchTimeSeconds: z.number().nonnegative().optional(),
  completionRate: z.number().min(0).max(1).optional(),
  likes: z.number().nonnegative().optional(),
  comments: z.number().nonnegative().optional(),
  clicks: z.number().nonnegative().optional(),
  impressions: z.number().nonnegative().optional(),
  conversions: z.number().nonnegative().optional(),
  spendCents: z.number().nonnegative().optional(),
  revenueCents: z.number().nonnegative().optional(),
  recordedAt: z.number().optional(),
  syncedAt: z.number().optional(),
  features: z
    .object({
      hookStyle: HookStyleSchema.optional(),
      voiceProfile: z.string().optional(),
      durationPattern: z.string().optional(),
      aspectRatio: z.enum(['9:16', '16:9', '1:1']).optional(),
      channel: z.string().optional(),
    })
    .optional(),
  metrics: z
    .object({
      views: z.number().nonnegative(),
      shares: z.number().nonnegative(),
      watchTimeSeconds: z.number().nonnegative(),
      averageWatchPercent: z.number().optional(),
      completionRate: z.number().min(0).max(1).optional(),
    })
    .optional(),
});
export type VideoEngagementFeedback = z.infer<typeof VideoEngagementFeedbackSchema>;

export const PatternUpdateDetailSchema = z.object({
  patternId: z.string(),
  featureKey: z.string(),
  featureValue: z.string(),
  previousAvg: z.number(),
  newAvg: z.number(),
  sampleSize: z.number(),
  retries: z.number(),
  status: z.enum(['updated', 'created', 'conflict_exhausted']),
});
export type PatternUpdateDetail = z.infer<typeof PatternUpdateDetailSchema>;

export const PatternUpdateResultSchema = z.object({
  patternId: z.string().optional(),
  videoId: z.string().optional(),
  previousScore: z.number().optional(),
  newScore: z.number().optional(),
  cesScore: z.number().optional(),
  sampleCount: z.number().optional(),
  sampleSize: z.number().optional(),
  confidence: z.number().min(0).max(1),
  confidenceLevel: z.enum(['high', 'medium', 'low']),
  updatedAt: z.number().optional(),
  casApplied: z.boolean().optional(),
  updatedPatterns: z.array(PatternUpdateDetailSchema).optional(),
  errors: z.array(z.string()).optional(),
  resolvedProvider: z.string().optional(),
  providerDiverted: z.boolean().optional(),
});
export type PatternUpdateResult = z.infer<typeof PatternUpdateResultSchema>;
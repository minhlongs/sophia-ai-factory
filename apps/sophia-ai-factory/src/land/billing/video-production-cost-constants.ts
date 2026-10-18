/**
 * Video Production Cost Constants & Types
 *
 * Real API pricing, infrastructure costs, production limits,
 * and shared interfaces for the cost engine.
 *
 * @module billing/video-production-cost-constants
 */

export type {
  CostBreakdown,
  ThroughputResult,
  ROIProjection,
  ARRProjection,
} from './video-production-cost-types';

/** Real API costs per video component (USD) */
export const API_COSTS = {
  /** HeyGen Scale API: ~$0.50/min for 60s video */
  heygen: { perMinute: 0.50, monthlyFixed: 99 },
  /** ElevenLabs Creator: ~$0.04 per script (~700 chars avg) */
  elevenlabs: { perScript: 0.04, monthlyFixed: 22 },
  /** OpenRouter: $0.03/script avg (gpt-4o-mini for BASIC, Claude 3.5 for ENTERPRISE) */
  openrouter: { perScript: 0.03, monthlyFixed: 0 },
  /** D-ID Build (optional): ~$1.13/min */
  did: { perMinute: 1.13, monthlyFixed: 18 },
  /** Kling 3.0 via fal.ai: ~$0.08/sec (between Wan and Sora pricing). Usage-based, no monthly fixed. */
  kling: { perSecond: 0.08, monthlyFixed: 0 },
  /** AssemblyAI Best tier: $0.0062/min of audio/video transcribed */
  assemblyai: { perMinute: 0.0062, monthlyFixed: 0 },
} as const;

/**
 * OpenAI gpt-image-1 thumbnail generation costs (USD per image).
 * Pricing: https://openai.com/api/pricing
 */
export const THUMBNAIL_COSTS = {
  /** HD quality, 1792x1024 (landscape, recommended for YouTube thumbnails) */
  hdLandscape: 0.040,
  /** HD quality, 1024x1024 (square) */
  hdSquare: 0.040,
  /** Standard quality, any supported size */
  standard: 0.020,
} as const;

/** Cloud + infrastructure costs (USD/month) */
export const INFRA_COSTS = {
  /** Cloudflare Workers Paid plan (includes D1, KV) */
  cloudflareWorkers: 5,
  /** Cloudflare R2 storage (~10GB video cache, $0.015/GB) */
  cloudflareR2: 0.15,
  /** Custom domain renewal (~$12/year ÷ 12) */
  domain: 1,
  /** Upstash Redis — rate limiting + nonce tracking */
  upstashRedis: 10,
  /** Inngest — background job queue for video pipeline */
  inngest: 25,
  /** Resend — billing email notifications */
  resend: 5,
  /** Telegram Bot API — free */
  telegram: 0,
  /** YouTube Data API — free */
  youtube: 0,
  /** TikTok Publishing API — free */
  tiktok: 0,
} as const;

/** Total monthly infrastructure cost */
export const MONTHLY_INFRA_COST = (Object.values(INFRA_COSTS) as number[]).reduce((a, b) => a + b, 0);

/** Production constraints */
export const PRODUCTION_LIMITS = {
  /** Average video duration in minutes */
  avgDurationMin: 1,
  /** HeyGen processing time per video (minutes) — includes queue + render */
  processingTimeMin: 4,
  /** Max parallel jobs (HeyGen Scale tier) */
  maxParallelJobs: 3,
  /** Hours per day the factory can operate */
  operatingHoursPerDay: 24,
} as const;

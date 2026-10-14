/**
 * Artifact and context interfaces for the YouTube content pipeline stages.
 * @module land/youtube/pipeline-stage-types
 */

import type { AIGenerateFn } from '@/tree/youtube-strategy/strategy-generator';

export interface ChannelConfigSnapshot {
  readonly objective: string;
  readonly audience: string;
  readonly contentPillars: readonly string[];
  readonly cadence: string;
  readonly postsPerWeek: number;
  readonly bufferDays: number;
  readonly autonomyLevel: number;
}

export interface StrategyArtifact {
  readonly topic: string;
  readonly angle: string;
  readonly targetAudience: string;
  readonly contentType: string;
  readonly keywords: readonly string[];
  readonly estimatedViews: number;
  readonly bestPublishTime: string;
}

export interface ScriptArtifact {
  readonly title: string;
  readonly hook: unknown;
  readonly introduction: unknown;
  readonly mainContent: unknown;
  readonly conclusion: unknown;
  readonly callToAction: unknown;
  readonly duration: string;
  readonly tone: string;
  readonly pacing: string;
  readonly keywords: readonly string[];
  readonly claims: readonly unknown[];
  readonly fullScript: string;
}

export interface SEOArtifact {
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly seoScore: number;
}

export interface ThumbnailArtifact {
  readonly path: string | null;
  readonly skipped: boolean;
  readonly reason?: string;
}

export interface QualityArtifact {
  readonly passed: boolean;
  readonly violations: readonly string[];
  readonly warnings: readonly string[];
}

export interface PipelineContext {
  readonly userId: string;
  readonly channelConfigId: string;
  readonly topic?: string | null;
  readonly generateText?: AIGenerateFn | null;
}

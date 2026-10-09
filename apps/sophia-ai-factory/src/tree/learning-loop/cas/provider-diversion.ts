/**
 * Optimistic Concurrency Control (OCC) CAS: Provider Diversion & Certification Routing.
 * Layer: tree (domain reusable)
 *
 * @module tree/learning-loop/cas/provider-diversion
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  isCertificationBlocking,
  resolveCertifiedProvider,
} from '@/seed/ai/provider-certification';
import type { VideoEngagementFeedback } from '@/seed/types/creative-intelligence';

export function checkAndLogProviderFallback(feedback: VideoEngagementFeedback) {
  isCertificationBlocking('hermes');
  const providerResolution = resolveCertifiedProvider('hermes', ['openrouter', 'anthropic']);
  if (providerResolution.diverted) {
    logger.warn(
      '[ScoringCAS] Hermes text provider blocked by certification gate — actively diverted text reasoning to certified provider',
      {
        videoId: feedback.videoId,
        originalProvider: providerResolution.originalProvider,
        divertedProvider: providerResolution.provider,
        reason: providerResolution.reason,
      },
    );
  }
  return providerResolution;
}

export interface PromptOptimizeRequest {
  readonly originalPrompt: string;
  readonly hookStyle?: string;
  readonly targetNiche?: string;
  readonly feedbackScore?: number;
}

export interface CreativeReasoningRequest {
  readonly brief: string;
  readonly audience?: string;
  readonly winningPatterns?: readonly string[];
}

/**
 * Actively diverts a prompt optimization task from an uncertified provider (e.g. 'hermes')
 * to a certified provider ('openrouter' / 'anthropic').
 *
 * @param request Prompt optimization payload
 * @param preferredProvider Target provider (default: 'hermes')
 * @param fallbackCandidates Ordered fallbacks (default: ['openrouter', 'anthropic'])
 */
export function divertPromptOptimization(
  request: PromptOptimizeRequest,
  preferredProvider = 'hermes',
  fallbackCandidates: readonly string[] = ['openrouter', 'anthropic'],
): {
  readonly resolvedProvider: string;
  readonly diverted: boolean;
  readonly originalProvider: string;
  readonly request: PromptOptimizeRequest;
} {
  const resolution = resolveCertifiedProvider(preferredProvider, fallbackCandidates);
  return {
    resolvedProvider: resolution.provider,
    diverted: resolution.diverted,
    originalProvider: resolution.originalProvider,
    request,
  };
}

/**
 * Actively diverts a creative reasoning task from an uncertified provider (e.g. 'hermes')
 * to a certified provider ('openrouter' / 'anthropic').
 *
 * @param request Creative reasoning payload
 * @param preferredProvider Target provider (default: 'hermes')
 * @param fallbackCandidates Ordered fallbacks (default: ['openrouter', 'anthropic'])
 */
export function divertCreativeReasoning(
  request: CreativeReasoningRequest,
  preferredProvider = 'hermes',
  fallbackCandidates: readonly string[] = ['openrouter', 'anthropic'],
): {
  readonly resolvedProvider: string;
  readonly diverted: boolean;
  readonly originalProvider: string;
  readonly request: CreativeReasoningRequest;
} {
  const resolution = resolveCertifiedProvider(preferredProvider, fallbackCandidates);
  return {
    resolvedProvider: resolution.provider,
    diverted: resolution.diverted,
    originalProvider: resolution.originalProvider,
    request,
  };
}

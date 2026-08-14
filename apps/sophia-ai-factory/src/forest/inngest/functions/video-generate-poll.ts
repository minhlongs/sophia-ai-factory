/**
 * Visual provider routing + polling for video generation pipeline.
 * HeyGen/D-ID (BYOK) → Wan 2.1 fallback → poll until video URL available.
 *
 * @module forest/inngest/functions/video-generate-poll
 */

import { logger } from '@/seed/utils/logger-utility';
import { selectWithStrategy, NoProvidersAvailableError } from '@/forest/quota/routing-strategy';
import type { RoutingContext } from '@/seed/config/routing-strategies';
import { buildProviderPool } from '@/forest/quota/provider-pool';
import {
  emitProgress, writeStageCheckpoint,
  POLL_MAX_ATTEMPTS,
} from './video-generate-helpers';
import { pollHeyGenVideo, pollDidVideo, pollWanVideo } from './video-generate-visual';

/** Sleep function type: (label, ms) → Promise<void> */
type SleepFn = (label: string, ms: number) => Promise<void>;

/** Parameters needed to execute the visual polling step. */
export interface VisualStepParams {
  userId: string;
  tenantId: string;
  missionId: string;
  prompt: string;
  routingStrategy: string;
  sleep: SleepFn;
}

/** Result of visual generation: the video URL and which provider produced it. */
export interface VisualStepResult {
  finalVideoUrl: string;
  selectedVisualProvider: string;
  /** Wan 2.1 prediction ID — only set when Wan was the provider. */
  wanJobId?: string;
}

/**
 * Select visual provider via routing strategy, poll until video ready.
 * Falls back from HeyGen/D-ID to Wan 2.1.
 */
export async function executeVisualStep(params: VisualStepParams): Promise<VisualStepResult> {
  const { userId, tenantId, missionId, prompt, routingStrategy, sleep } = params;

  let finalVideoUrl: string | undefined;
  let selectedVisualProvider: string | undefined;
  let wanJobId: string | undefined;

  const visualContext: RoutingContext = { taskType: 'visual', estimatedInputTokens: prompt.length };
  const visualPool = await buildProviderPool(userId, visualContext);

  let visualDecision: { provider: string; strategy: string } | null = null;
  if (visualPool.length > 0) {
    try {
      const decision = selectWithStrategy(visualPool, visualContext, routingStrategy);
      visualDecision = { provider: decision.provider, strategy: decision.strategy };
      selectedVisualProvider = visualDecision.provider;
    } catch (err) {
      if (err instanceof NoProvidersAvailableError) {
        logger.info('[videoGenerate] No visual providers available, falling back to Wan Video', { strategy: routingStrategy });
        await emitProgress(missionId, 'error', 0, 'Không có nhà cung cấp khả dụng / No providers available for visual');
        await writeStageCheckpoint(missionId, 'generate_visual', 'failed', tenantId, {}, 'no_providers_available');
      } else {
        throw err;
      }
    }
  } else {
    logger.info('[videoGenerate] Visual provider pool empty, falling back to Wan Video', { strategy: routingStrategy });
  }

  const hasHeyGenKey = visualPool.find(c => c.provider === 'heygen')?.hasUserKey;
  const hasDidKey = visualPool.find(c => c.provider === 'd-id')?.hasUserKey;

  // Try HeyGen (BYOK) → D-ID (BYOK) → Wan 2.1 fallback
  try {
    if (visualDecision?.provider === 'heygen' && hasHeyGenKey) {
      try {
        const result = await pollHeyGenVideo(userId, prompt, missionId, sleep);
        if (result.videoUrl) {
          finalVideoUrl = result.videoUrl;
          selectedVisualProvider = result.provider;
        }
      } catch (err) {
        logger.warn('[videoGenerate] HeyGen visual failed, falling back to Wan Video', {
          strategy: routingStrategy,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!finalVideoUrl && visualDecision?.provider === 'd-id' && hasDidKey) {
      try {
        const result = await pollDidVideo(userId, prompt, sleep);
        if (result.videoUrl) {
          finalVideoUrl = result.videoUrl;
          selectedVisualProvider = result.provider;
        }
      } catch (err) {
        logger.warn('[videoGenerate] D-ID visual failed, falling back to Wan Video', {
          strategy: routingStrategy,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Wan 2.1 fallback
    if (!finalVideoUrl) {
      const result = await pollWanVideo(prompt, sleep);
      if (result.videoUrl) {
        finalVideoUrl = result.videoUrl;
        selectedVisualProvider = result.provider;
        wanJobId = result.wanJobId;
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await emitProgress(missionId, 'error', 0, `Lỗi tạo video / Video generation failed: ${errorMsg}`);
    await writeStageCheckpoint(missionId, 'poll_video_ready', 'failed', tenantId, {}, errorMsg);
    throw err;
  }

  if (!finalVideoUrl) {
    await emitProgress(missionId, 'error', 0, `Hết thời gian chờ / Video generation timed out after ${POLL_MAX_ATTEMPTS} polls`);
    await writeStageCheckpoint(missionId, 'poll_video_ready', 'failed', tenantId, {}, 'timeout');
    throw new Error(`[videoGenerate] Visual generation failed — no provider returned a video URL`);
  }

  return { finalVideoUrl, selectedVisualProvider: selectedVisualProvider ?? 'wan-video', wanJobId };
}

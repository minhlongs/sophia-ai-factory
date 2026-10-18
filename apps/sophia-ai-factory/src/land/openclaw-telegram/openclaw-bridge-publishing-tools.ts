/**
 * OpenClaw Bridge publishing & SEO script tool wrappers.
 * @module land/openclaw-telegram/openclaw-bridge-publishing-tools
 */

import {
  generateSeoScript,
  SeoScriptConfigurationError,
  type GenerateSeoScriptResult,
} from '@/land/scripts/generate-seo-script';
import {
  schedulePublish as schedulePublishAction,
  PublishConfigurationError,
} from '@/land/publish/schedule-video-publish';

// ─── 10. sophia_generate_seo_script (homepage promise: AI script + SEO) ──────

export interface SeoScriptBridgeInput {
  userId: string;
  topic: string;
  keywords?: string[];
  language?: 'en' | 'vi';
}

export type SeoScriptBridgeResult =
  | { ok: true; result: GenerateSeoScriptResult }
  | { ok: false; code: 'BYOK_REQUIRED' | 'EMPTY_TOPIC' | 'UPSTREAM_FAILED'; message: string };

export async function callGenerateSeoScript(
  input: SeoScriptBridgeInput,
): Promise<SeoScriptBridgeResult> {
  try {
    const result = await generateSeoScript(input);
    return { ok: true, result };
  } catch (err) {
    if (err instanceof SeoScriptConfigurationError) {
      return { ok: false, code: err.code, message: err.message };
    }
    return {
      ok: false,
      code: 'UPSTREAM_FAILED',
      message: err instanceof Error ? err.message : 'unknown',
    };
  }
}

// ─── 11. sophia_schedule_publish (homepage promise: 24/7 auto-publish) ───────

export interface SchedulePublishBridgeInput {
  userId: string;
  videoId: string;
  channelId: string;
  scheduledAt: number;
  caption?: string;
}

export type SchedulePublishBridgeResult =
  | { ok: true; result: { jobId: string; scheduledAt: number; status: string } }
  | { ok: false; code: 'DB_ERROR' | 'INVALID_INPUT' | 'UPSTREAM_FAILED'; message: string };

export async function callSchedulePublish(
  input: SchedulePublishBridgeInput,
): Promise<SchedulePublishBridgeResult> {
  try {
    const result = await schedulePublishAction({
      videoId: input.videoId,
      channelId: input.channelId,
      userId: input.userId,
      scheduledAt: input.scheduledAt,
      caption: input.caption,
    });
    return {
      ok: true,
      result: {
        jobId: result.jobId,
        scheduledAt: result.scheduledAt,
        status: result.status,
      },
    };
  } catch (err: unknown) {
    if (err instanceof PublishConfigurationError) {
      return { ok: false, code: 'INVALID_INPUT', message: err.message };
    }
    const message = err instanceof Error ? err.message : 'unknown';
    return { ok: false, code: 'UPSTREAM_FAILED', message };
  }
}

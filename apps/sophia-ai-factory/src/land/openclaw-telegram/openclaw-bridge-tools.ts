/**
 * OpenClaw Bridge tool wrappers: translate, voice clone, SEO script, schedule publish.
 * @module land/openclaw-telegram/openclaw-bridge-tools
 */

import { translateScript, TranslateConfigurationError, type TranslateScriptResult } from '@/land/i18n/translate-script';
import { cloneVoice, VoiceCloneConfigurationError, type CloneVoiceResult } from '@/land/voice/clone-voice';
import { generateSeoScript, SeoScriptConfigurationError, type GenerateSeoScriptResult } from '@/land/scripts/generate-seo-script';
import { schedulePublish as schedulePublishAction } from '@/forest/publishing/schedule-publish';
import { buildVideoDescription } from '@/land/affiliates/video-description-injector';
import { getD1 } from '@/seed/db/client';

// ─── 7. sophia_embed_affiliate (homepage promise algorithm) ──────────────────

export interface EmbedAffiliateInput {
  userId: string;
  videoId?: string;
  baseBody?: string;
  nicheHint?: string;
  maxLinks?: number;
}

export interface EmbedAffiliateResult {
  description: string;
  affiliateCount: number;
}

export async function callEmbedAffiliateInDescription(
  input: EmbedAffiliateInput,
): Promise<EmbedAffiliateResult> {
  const result = await buildVideoDescription({
    userId: input.userId,
    baseBody: input.baseBody,
    videoTitle: input.videoId,
    nicheHint: input.nicheHint,
    maxLinks: input.maxLinks,
  });
  return { description: result.description, affiliateCount: result.affiliateCount };
}

// ─── 8. sophia_translate_script (homepage promise: global reach via BYOK) ────

export interface TranslateBridgeInput {
  userId: string;
  text: string;
  fromLang: string;
  toLang: string;
  tone?: 'literal' | 'natural';
}

export interface TranslateBridgeResult {
  ok: true;
  result: TranslateScriptResult;
}

export interface TranslateBridgeError {
  ok: false;
  code: 'BYOK_REQUIRED' | 'EMPTY_TEXT' | 'UPSTREAM_FAILED' | 'BYOK_DISABLED';
  message: string;
}

export async function callTranslateScript(
  input: TranslateBridgeInput,
): Promise<TranslateBridgeResult | TranslateBridgeError> {
  try {
    const result = await translateScript(input);
    return { ok: true, result };
  } catch (err) {
    if (err instanceof TranslateConfigurationError) {
      return { ok: false, code: err.code as TranslateBridgeError['code'], message: err.message };
    }
    return { ok: false, code: 'UPSTREAM_FAILED', message: err instanceof Error ? err.message : 'unknown' };
  }
}

// ─── 9. sophia_clone_voice (homepage promise: ElevenLabs voice via BYOK) ─────

export interface CloneVoiceBridgeInput {
  userId: string;
  name: string;
  audioUrls: string[];
  description?: string;
}

export type CloneVoiceBridgeResult =
  | { ok: true; result: CloneVoiceResult }
  | { ok: false; code: 'BYOK_REQUIRED' | 'EMPTY_AUDIO' | 'NAME_INVALID' | 'TOO_MANY_SAMPLES' | 'SAMPLE_TOO_LARGE' | 'UPSTREAM_FAILED'; message: string };

export async function callCloneVoice(input: CloneVoiceBridgeInput): Promise<CloneVoiceBridgeResult> {
  try {
    const result = await cloneVoice(input);
    return { ok: true, result };
  } catch (err) {
    if (err instanceof VoiceCloneConfigurationError) {
      return { ok: false, code: err.code, message: err.message };
    }
    return { ok: false, code: 'UPSTREAM_FAILED', message: err instanceof Error ? err.message : 'unknown' };
  }
}

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

export async function callGenerateSeoScript(input: SeoScriptBridgeInput): Promise<SeoScriptBridgeResult> {
  try {
    const result = await generateSeoScript(input);
    return { ok: true, result };
  } catch (err) {
    if (err instanceof SeoScriptConfigurationError) {
      return { ok: false, code: err.code, message: err.message };
    }
    return { ok: false, code: 'UPSTREAM_FAILED', message: err instanceof Error ? err.message : 'unknown' };
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
  const d1 = getD1();
  if (!d1) {
    return { ok: false, code: 'DB_ERROR', message: 'Database not available' };
  }

  try {
    const result = await schedulePublishAction(d1, {
      videoId: input.videoId,
      channelId: input.channelId,
      tenantId: input.userId,
      userId: input.userId,
      scheduledAt: input.scheduledAt,
      caption: input.caption,
    });
    return {
      ok: true,
      result: {
        jobId: result.jobId,
        scheduledAt: input.scheduledAt,
        status: 'scheduled',
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown';
    return { ok: false, code: 'UPSTREAM_FAILED', message };
  }
}

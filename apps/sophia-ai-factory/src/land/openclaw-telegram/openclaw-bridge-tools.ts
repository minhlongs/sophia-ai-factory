/**
 * OpenClaw Bridge tool wrappers: translate, voice clone, SEO script, schedule publish.
 * @module land/openclaw-telegram/openclaw-bridge-tools
 */

import {
  translateScript,
  TranslateConfigurationError,
  type TranslateScriptResult,
} from '@/land/i18n/translate-script';
import {
  cloneVoice,
  VoiceCloneConfigurationError,
  type CloneVoiceResult,
} from '@/land/voice/clone-voice';
import { buildVideoDescription } from '@/land/affiliates/video-description-injector';

export {
  type SeoScriptBridgeInput,
  type SeoScriptBridgeResult,
  callGenerateSeoScript,
  type SchedulePublishBridgeInput,
  type SchedulePublishBridgeResult,
  callSchedulePublish,
} from './openclaw-bridge-publishing-tools';

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
    return {
      ok: false,
      code: 'UPSTREAM_FAILED',
      message: err instanceof Error ? err.message : 'unknown',
    };
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
  | {
      ok: false;
      code:
        | 'BYOK_REQUIRED'
        | 'EMPTY_AUDIO'
        | 'NAME_INVALID'
        | 'TOO_MANY_SAMPLES'
        | 'SAMPLE_TOO_LARGE'
        | 'UPSTREAM_FAILED';
      message: string;
    };

export async function callCloneVoice(
  input: CloneVoiceBridgeInput,
): Promise<CloneVoiceBridgeResult> {
  try {
    const result = await cloneVoice(input);
    return { ok: true, result };
  } catch (err) {
    if (err instanceof VoiceCloneConfigurationError) {
      return { ok: false, code: err.code, message: err.message };
    }
    return {
      ok: false,
      code: 'UPSTREAM_FAILED',
      message: err instanceof Error ? err.message : 'unknown',
    };
  }
}

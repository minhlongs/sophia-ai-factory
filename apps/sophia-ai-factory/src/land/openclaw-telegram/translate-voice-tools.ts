/**
 * Translate and voice clone tools for OpenClaw Bridge
 * @module land/openclaw-telegram/translate-voice-tools
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
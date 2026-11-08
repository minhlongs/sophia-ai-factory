/**
 * Kokoro-82M TTS Adapter (`/v1/audio/speech` OpenAI-compatible HTTP endpoint).
 *
 * Splits narration scripts into sentence chunks, synthesizes each chunk with
 * circuit-breaker protection and failure classification, and routes Vietnamese
 * locales (`vi`, `vi-VN`) to the customer's BYOK ElevenLabs key.
 *
 * Layer: tree (domain reusable logic)
 * @module tree/video/audio/kokoro-tts-adapter
 */

import { recordFailure, recordSuccess, shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus, FailureKind } from '@/seed/types/failure-kind';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  generateNicheCampaignVoiceover,
  type GenerateNicheVoiceoverInput,
  type NicheVoiceoverDeps,
  type VoiceoverFailureCode,
} from '@/tree/video/render/niche-voiceover-generator';

const KOKORO_SERVICE_NAME = 'kokoro-tts';
const DEFAULT_MAX_CHUNK_CHARS = 280;
const WORDS_PER_SECOND_ESTIMATE = 2.6;

export type KokoroSupportedLocale = 'en' | 'zh' | 'ja' | 'fr' | 'vi' | string;

export interface KokoroTtsInput {
  planId: string; userId: string; tenantId?: string; text: string;
  locale?: KokoroSupportedLocale; voiceId?: string; speed?: number;
  baseUrl?: string; apiKey?: string; maxChunkChars?: number;
}

export interface KokoroChunkAudio {
  chunkIndex: number; sentence: string; byteLength: number; durationSec: number;
}

export interface KokoroTtsResult {
  success: boolean; provider: 'kokoro' | 'elevenlabs' | 'mock'; routedToByok: boolean;
  audioUrl?: string; audioBytes?: Uint8Array; durationSec?: number; chunks?: KokoroChunkAudio[];
  error?: string; errorCode?: VoiceoverFailureCode; failureKind?: FailureKind;
}

export interface KokoroTtsDeps {
  fetchFn?: typeof fetch;
  byokFallback?: typeof generateNicheCampaignVoiceover;
  byokDeps?: NicheVoiceoverDeps;
}

const KOKORO_VOICE_PRESETS: Record<string, string> = {
  en: 'af_heart', zh: 'zf_xiaobei', ja: 'jf_alpha', fr: 'ff_siwis',
};

export function isVietnameseLocale(locale: string | undefined): boolean {
  if (!locale) return false;
  const n = locale.trim().toLowerCase();
  return n === 'vi' || n.startsWith('vi-') || n.startsWith('vi_');
}

function splitWordsByCap(piece: string, cap: number): string[] {
  const result: string[] = [];
  let buf = '';
  for (const word of piece.split(' ').filter(Boolean)) {
    const candidate = buf ? `${buf} ${word}` : word;
    if (candidate.length <= cap) {
      buf = candidate;
      continue;
    }
    if (buf) { result.push(buf); buf = ''; }
    if (word.length <= cap) buf = word;
    else {
      for (let idx = 0; idx < word.length; idx += cap) result.push(word.slice(idx, idx + cap));
    }
  }
  if (buf) result.push(buf);
  return result;
}

/** Splits narration into sentence-aligned chunks no longer than `maxChunkChars`. */
export function chunkScriptIntoSentences(rawText: string, maxChunkChars = DEFAULT_MAX_CHUNK_CHARS): string[] {
  const normalized = rawText.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const cap = Math.max(40, maxChunkChars);
  const sentences = normalized.split(/(?<=[.!?。！？])\s+/).map((s) => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (sentence.length > cap) {
      if (current) { chunks.push(current); current = ''; }
      chunks.push(...splitWordsByCap(sentence, cap));
      continue;
    }
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= cap) current = candidate;
    else { chunks.push(current); current = sentence; }
  }
  if (current) chunks.push(current);
  return chunks;
}

function mapFailureKindToCode(kind: FailureKind): VoiceoverFailureCode {
  if (kind === FailureKind.AUTH_FAILURE || kind === FailureKind.PROVIDER_AUTH_FAILURE) return 'PROVIDER_AUTH_FAILED';
  if (kind === FailureKind.RATE_LIMIT || kind === FailureKind.BILLING_FAILURE) return 'PROVIDER_QUOTA_EXCEEDED';
  if (kind === FailureKind.TIMEOUT) return 'PROVIDER_TIMEOUT';
  return 'PROVIDER_FAILED';
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const merged = new Uint8Array(arrays.reduce((acc, a) => acc + a.byteLength, 0));
  let offset = 0;
  for (const arr of arrays) { merged.set(arr, offset); offset += arr.byteLength; }
  return merged;
}

async function routeVietnameseToByok(input: KokoroTtsInput, deps?: KokoroTtsDeps): Promise<KokoroTtsResult> {
  const fallback = deps?.byokFallback ?? generateNicheCampaignVoiceover;
  const byokInput: GenerateNicheVoiceoverInput = {
    planId: input.planId, userId: input.userId, tenantId: input.tenantId,
    narrationText: input.text, locale: 'vi', voiceId: input.voiceId,
  };
  const byok = await fallback(byokInput, deps?.byokDeps);
  return {
    success: byok.success, provider: byok.success ? 'elevenlabs' : 'mock', routedToByok: true,
    audioUrl: byok.audioUrl, durationSec: byok.durationSec, error: byok.error, errorCode: byok.errorCode,
  };
}

async function synthesizeChunks(
  chunks: string[],
  opts: { baseUrl: string; apiKey?: string; voice: string; speed: number; keyRef: string; fetchFn: typeof fetch },
): Promise<KokoroTtsResult> {
  const chunkBuffers: Uint8Array[] = [];
  const chunkMeta: KokoroChunkAudio[] = [];
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;

  for (let i = 0; i < chunks.length; i++) {
    const sentence = chunks[i];
    const response = await opts.fetchFn(`${opts.baseUrl}/v1/audio/speech`, {
      method: 'POST', headers,
      body: JSON.stringify({ model: 'kokoro-82m', input: sentence, voice: opts.voice, response_format: 'mp3', speed: opts.speed }),
    });
    if (!response.ok) {
      const kind = classifyHttpStatus(response.status);
      recordFailure(KOKORO_SERVICE_NAME, kind, opts.keyRef);
      const errorCode = mapFailureKindToCode(kind);
      return { success: false, provider: 'mock', routedToByok: false, error: `${errorCode}: Kokoro HTTP ${response.status}`, errorCode, failureKind: kind };
    }
    const buf = new Uint8Array(await response.arrayBuffer());
    if (buf.byteLength === 0) {
      recordFailure(KOKORO_SERVICE_NAME, FailureKind.SERVER_ERROR, opts.keyRef);
      return { success: false, provider: 'mock', routedToByok: false, error: 'MOCK_OUTPUT_REJECTED: Kokoro returned empty audio payload', errorCode: 'MOCK_OUTPUT_REJECTED', failureKind: FailureKind.SERVER_ERROR };
    }
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;
    const durationSec = Math.max(0.4, Number((wordCount / (WORDS_PER_SECOND_ESTIMATE * opts.speed)).toFixed(2)));
    chunkBuffers.push(buf);
    chunkMeta.push({ chunkIndex: i, sentence, byteLength: buf.byteLength, durationSec });
  }

  recordSuccess(KOKORO_SERVICE_NAME, opts.keyRef);
  return {
    success: true, provider: 'kokoro', routedToByok: false,
    audioBytes: concatUint8Arrays(chunkBuffers),
    durationSec: Number(chunkMeta.reduce((sum, c) => sum + c.durationSec, 0).toFixed(2)),
    chunks: chunkMeta,
  };
}

export async function synthesizeWithKokoroOrByok(input: KokoroTtsInput, deps?: KokoroTtsDeps): Promise<KokoroTtsResult> {
  const locale = (input.locale ?? 'en').trim();
  if (isVietnameseLocale(locale)) return routeVietnameseToByok(input, deps);

  const baseUrl = (input.baseUrl ?? process.env.KOKORO_TTS_BASE_URL ?? '').trim().replace(/\/+$/, '');
  if (!baseUrl) return { success: false, provider: 'mock', routedToByok: false, error: 'CREDENTIALS_MISSING: KOKORO_TTS_BASE_URL is not configured', errorCode: 'CREDENTIALS_MISSING' };

  const chunks = chunkScriptIntoSentences(input.text, input.maxChunkChars);
  if (chunks.length === 0) return { success: false, provider: 'mock', routedToByok: false, error: 'PROVIDER_FAILED: Narration script is empty after normalization', errorCode: 'PROVIDER_FAILED' };

  const keyRef = input.tenantId || input.userId;
  if (!shouldAllowRequest(KOKORO_SERVICE_NAME, keyRef)) return { success: false, provider: 'mock', routedToByok: false, error: 'PROVIDER_FAILED: Kokoro TTS circuit breaker is open', errorCode: 'PROVIDER_FAILED' };

  const voice = input.voiceId || KOKORO_VOICE_PRESETS[locale.slice(0, 2).toLowerCase()] || KOKORO_VOICE_PRESETS.en;
  const speed = typeof input.speed === 'number' && input.speed > 0 ? input.speed : 1.0;

  try {
    return await synthesizeChunks(chunks, { baseUrl, apiKey: input.apiKey, voice, speed, keyRef, fetchFn: deps?.fetchFn ?? fetch });
  } catch (err: unknown) {
    const error = toError(err);
    const kind = classifyError(error);
    recordFailure(KOKORO_SERVICE_NAME, kind, keyRef);
    const errorCode = mapFailureKindToCode(kind);
    logger.warn('[KokoroTTS] synthesis failed', { planId: input.planId, errorCode, failureKind: kind, error: error.message });
    return { success: false, provider: 'mock', routedToByok: false, error: `${errorCode}: ${error.message}`, errorCode, failureKind: kind };
  }
}

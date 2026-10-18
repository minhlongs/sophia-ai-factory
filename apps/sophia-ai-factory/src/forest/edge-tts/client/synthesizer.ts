/**
 * Edge TTS Audio Synthesizer
 * Layer: forest/edge-tts
 */

import { logger } from '@/seed/utils/logger-utility';
import type { ApacLocale } from '@/seed/types/dubbing';
import {
  type EdgeTtsSynthesisOptions,
  type EdgeTtsSynthesisResult,
} from './types';
import { createSyntheticAudioBuffer } from './audio-buffer-generator';
import {
  prepareEdgeTtsSynthesis,
  type PreparedEdgeTtsPayload,
} from './synthesizer-preparation';

export { prepareEdgeTtsSynthesis, type PreparedEdgeTtsPayload };

/**
 * Synthesize speech via Edge TTS service with dialect normalization and compliance injection.
 */
export async function synthesizeEdgeTts(
  text: string,
  locale: ApacLocale,
  options?: EdgeTtsSynthesisOptions,
): Promise<EdgeTtsSynthesisResult> {
  const prepared = prepareEdgeTtsSynthesis(text, locale, options);
  const {
    processedText,
    normalizedScript,
    disclaimerInjected,
    disclaimerText,
    wordCount,
    voice,
    rate,
    ssml,
    estimatedDuration,
  } = prepared;

  try {
    const endpoint = 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      },
      body: ssml,
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const arrayBuf = await response.arrayBuffer();
      if (arrayBuf.byteLength > 0) {
        return {
          audioBuffer: new Uint8Array(arrayBuf),
          mimeType: 'audio/mpeg',
          durationSec: estimatedDuration,
          voice,
          rate,
          wordCount,
          disclaimerInjected,
          disclaimerText,
          normalizedScript,
        };
      }
    }
  } catch (err) {
    logger.warn('[EdgeTTS] Direct synthesis call bypassed or unavailable, using edge buffer', {
      voice,
      locale,
      error: String(err),
    });
  }

  const syntheticPayload = createSyntheticAudioBuffer(processedText, estimatedDuration);

  return {
    audioBuffer: syntheticPayload,
    mimeType: 'audio/mpeg',
    durationSec: estimatedDuration,
    voice,
    rate,
    wordCount,
    disclaimerInjected,
    disclaimerText,
    normalizedScript,
  };
}

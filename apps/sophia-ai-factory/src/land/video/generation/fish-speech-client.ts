/**
 * Fish Speech TTS Client
 *
 * Wraps the fal.ai Fish Speech model for text-to-speech generation.
 * Endpoint: https://fal.ai/models/fal-ai/fish-speech
 *
 * Fish Speech is fast enough to treat as synchronous (single request/response).
 * Supports en (English) and vi (Vietnamese) language codes.
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type {
  SpeechGenerateParams,
  SpeechGenerateResult,
  FishSpeechApiInput,
  FishSpeechApiOutput,
} from '../templates/types';

const FAL_BASE_URL = 'https://fal.run/fal-ai/fish-speech';
const DEFAULT_TIMEOUT_MS = 60_000; // 60s

export class FishSpeechClientError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'FishSpeechClientError';
  }
}

export interface FishSpeechClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export class FishSpeechClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor({ apiKey, baseUrl, timeoutMs }: FishSpeechClientConfig) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl ?? FAL_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Generate speech from text. Returns audioUrl + durationSec.
   * Synchronous-style: sends request and waits for result.
   */
  async generateSpeech(params: SpeechGenerateParams): Promise<SpeechGenerateResult> {
    if (!shouldAllowRequest('fish-speech')) {
      throw new FishSpeechClientError(0, 'Circuit breaker open for Fish Speech — too many failures');
    }

    const input: FishSpeechApiInput = {
      text: params.text,
      ...(params.voice ? { voice: params.voice } : {}),
      ...(params.language ? { language: params.language } : {}),
    };

    logger.info('[FishSpeechClient] Generating speech', {
      textLength: params.text.length,
      language: params.language ?? 'en',
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Key ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input }),
        signal: controller.signal,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const output = (await response.json()) as FishSpeechApiOutput;

      const audioUrl = output.audio?.url;
      if (!audioUrl) {
        throw new FishSpeechClientError(0, '[FishSpeechClient] No audio URL in response');
      }

      const durationSec = output.duration ?? 0;

      logger.info('[FishSpeechClient] Speech generated', { audioUrl, durationSec });

      recordSuccess('fish-speech');
      return { audioUrl, durationSec };
    } catch (error) {
      if (error instanceof FishSpeechClientError) throw error;
      const kind = classifyError(error);
      recordFailure('fish-speech', kind);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const body = await response.text().catch((err) => {
      logger.warn('Failed to read response body', { error: String(err), context: 'handleErrorResponse' });
      return '';
    });
    const code = response.status;

    if (code === 429) {
      throw new FishSpeechClientError(429, `[FishSpeechClient] Rate limit exceeded: ${body}`);
    }
    if (code === 402) {
      throw new FishSpeechClientError(402, `[FishSpeechClient] Payment required — check fal.ai credits: ${body}`);
    }
    if (code === 400) {
      throw new FishSpeechClientError(400, `[FishSpeechClient] Invalid input: ${body}`);
    }
    throw new FishSpeechClientError(code, `[FishSpeechClient] API error ${code}: ${body}`);
  }
}

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  AssemblyAIClientConfig,
  TranscriptResponse,
  TranscribeParams,
  TranscribeResult,
} from './types';
import { handleErrorResponse } from './error-handler';

export class AssemblyAIClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor({ apiKey, baseUrl, timeoutMs }: AssemblyAIClientConfig) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Submit a transcription job from a publicly-accessible audio/video URL.
   * Returns immediately with transcriptId + initial status ('queued').
   */
  async transcribe(params: TranscribeParams): Promise<TranscribeResult> {
    const body: Record<string, unknown> = {
      audio_url: params.audioUrl,
      punctuate: params.punctuate ?? true,
    };

    if (params.languageCode && params.languageCode !== 'auto') {
      body.language_code = params.languageCode;
    }

    if (params.speakerLabels === true) {
      body.speaker_labels = true;
    }

    if (!shouldAllowRequest('assemblyai')) {
      logger.warn('[AssemblyAIClient] Circuit breaker open for assemblyai, request blocked');
      throw new Error('Circuit breaker open for assemblyai — request blocked');
    }

    logger.info('[AssemblyAIClient] Submitting transcription job', {
      audioUrl: params.audioUrl,
      languageCode: params.languageCode ?? 'auto',
      speakerLabels: params.speakerLabels ?? false,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/transcript`, {
        method: 'POST',
        headers: {
          Authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        await handleErrorResponse(response, 'transcribe');
      }

      const data = (await response.json()) as { id: string; status: string };

      logger.info('[AssemblyAIClient] Transcription job submitted', {
        transcriptId: data.id,
        status: data.status,
      });

      recordSuccess('assemblyai');
      return { transcriptId: data.id, status: data.status };
    } catch (error) {
      recordFailure('assemblyai', classifyError(error));
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Poll transcription status by transcript ID.
   * Caller is responsible for polling until status is 'completed' or 'error'.
   */
  async getTranscript(transcriptId: string): Promise<TranscriptResponse> {
    if (!shouldAllowRequest('assemblyai')) {
      logger.warn('[AssemblyAIClient] Circuit breaker open for assemblyai, request blocked');
      throw new Error('Circuit breaker open for assemblyai — request blocked');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/transcript/${transcriptId}`, {
        headers: {
          Authorization: this.apiKey,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        await handleErrorResponse(response, 'getTranscript');
      }

      const data = (await response.json()) as TranscriptResponse;

      logger.info('[AssemblyAIClient] Transcript polled', {
        transcriptId,
        status: data.status,
      });

      recordSuccess('assemblyai');
      return data;
    } catch (error) {
      recordFailure('assemblyai', classifyError(error));
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Retrieve subtitles in SRT or VTT format for a completed transcript.
   * Returns the raw subtitle string (plain text, not JSON).
   */
  async getSubtitles(transcriptId: string, format: 'srt' | 'vtt'): Promise<string> {
    if (!shouldAllowRequest('assemblyai')) {
      logger.warn('[AssemblyAIClient] Circuit breaker open for assemblyai, request blocked');
      throw new Error('Circuit breaker open for assemblyai — request blocked');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/transcript/${transcriptId}/${format}`, {
        headers: {
          Authorization: this.apiKey,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        await handleErrorResponse(response, 'getSubtitles');
      }

      const subtitles = await response.text();

      logger.info('[AssemblyAIClient] Subtitles retrieved', {
        transcriptId,
        format,
        length: subtitles.length,
      });

      recordSuccess('assemblyai');
      return subtitles;
    } catch (error) {
      recordFailure('assemblyai', classifyError(error));
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * AssemblyAI Transcription Client
 *
 * Wraps the AssemblyAI REST API v2 for audio/video transcription and caption generation.
 * Base URL: https://api.assemblyai.com/v2
 * Auth: Header `Authorization: ${apiKey}` (no "Bearer" prefix — AssemblyAI convention)
 *
 * Handles: rate limit (429), payment required (402), invalid request (400), not found (404).
 * Uses AbortController with configurable timeout (default 30s per request).
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

const DEFAULT_BASE_URL = 'https://api.assemblyai.com/v2';
const DEFAULT_TIMEOUT_MS = 30_000; // 30s per individual request

export class AssemblyAIClientError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AssemblyAIClientError';
  }
}

export interface AssemblyAIClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface TranscriptWord {
  text: string;
  start: number; // milliseconds
  end: number;   // milliseconds
  confidence: number;
}

export interface TranscriptUtterance {
  text: string;
  start: number; // milliseconds
  end: number;   // milliseconds
  speaker: string;
}

export type TranscriptStatus = 'queued' | 'processing' | 'completed' | 'error';

export interface TranscriptResponse {
  id: string;
  status: TranscriptStatus;
  text?: string;
  words?: TranscriptWord[];
  utterances?: TranscriptUtterance[];
  error?: string;
}

export interface TranscribeParams {
  audioUrl: string;
  /** BCP-47 language code: 'en', 'vi', or 'auto' for auto-detect. Default: 'auto' */
  languageCode?: string;
  speakerLabels?: boolean;
  punctuate?: boolean;
}

export interface TranscribeResult {
  transcriptId: string;
  status: string;
}

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

    // 'auto' means omit language_code — AssemblyAI auto-detects when field is absent
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
        await this.handleErrorResponse(response, 'transcribe');
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
        await this.handleErrorResponse(response, 'getTranscript');
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
        await this.handleErrorResponse(response, 'getSubtitles');
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

  private async handleErrorResponse(response: Response, operation: string): Promise<never> {
    const body = await response.text().catch((err) => {
      logger.warn('Failed to read response body', { error: String(err), context: 'handleErrorResponse' });
      return '';
    });
    const code = response.status;

    if (code === 429) {
      throw new AssemblyAIClientError(429, `[AssemblyAIClient.${operation}] Rate limit exceeded: ${body}`);
    }
    if (code === 402) {
      throw new AssemblyAIClientError(402, `[AssemblyAIClient.${operation}] Payment required — check AssemblyAI credits: ${body}`);
    }
    if (code === 400) {
      throw new AssemblyAIClientError(400, `[AssemblyAIClient.${operation}] Invalid request parameters: ${body}`);
    }
    if (code === 404) {
      throw new AssemblyAIClientError(404, `[AssemblyAIClient.${operation}] Transcript not found: ${body}`);
    }
    throw new AssemblyAIClientError(code, `[AssemblyAIClient.${operation}] API error ${code}: ${body}`);
  }
}

import { logger } from '@/seed/utils/logger-utility';
import {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  AssemblyAIClientConfig,
  TranscriptResponse,
  TranscribeParams,
  TranscribeResult,
} from './types';
import {
  buildTranscribeRequestBody,
  executeAssemblyAIRequest,
} from './request-executor';

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
    const body = buildTranscribeRequestBody(params);

    return executeAssemblyAIRequest(
      {
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
        timeoutMs: this.timeoutMs,
        path: '/transcript',
        operation: 'transcribe',
        method: 'POST',
        body,
      },
      async (response) => {
        logger.info('[AssemblyAIClient] Submitting transcription job', {
          audioUrl: params.audioUrl,
          languageCode: params.languageCode ?? 'auto',
          speakerLabels: params.speakerLabels ?? false,
        });
        const data = (await response.json()) as { id: string; status: string };
        logger.info('[AssemblyAIClient] Transcription job submitted', {
          transcriptId: data.id,
          status: data.status,
        });
        return { transcriptId: data.id, status: data.status };
      },
    );
  }

  /**
   * Poll transcription status by transcript ID.
   * Caller is responsible for polling until status is 'completed' or 'error'.
   */
  async getTranscript(transcriptId: string): Promise<TranscriptResponse> {
    return executeAssemblyAIRequest(
      {
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
        timeoutMs: this.timeoutMs,
        path: `/transcript/${transcriptId}`,
        operation: 'getTranscript',
      },
      async (response) => {
        const data = (await response.json()) as TranscriptResponse;
        logger.info('[AssemblyAIClient] Transcript polled', {
          transcriptId,
          status: data.status,
        });
        return data;
      },
    );
  }

  /**
   * Retrieve subtitles in SRT or VTT format for a completed transcript.
   * Returns the raw subtitle string (plain text, not JSON).
   */
  async getSubtitles(transcriptId: string, format: 'srt' | 'vtt'): Promise<string> {
    return executeAssemblyAIRequest(
      {
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
        timeoutMs: this.timeoutMs,
        path: `/transcript/${transcriptId}/${format}`,
        operation: 'getSubtitles',
      },
      async (response) => {
        const subtitles = await response.text();
        logger.info('[AssemblyAIClient] Subtitles retrieved', {
          transcriptId,
          format,
          length: subtitles.length,
        });
        return subtitles;
      },
    );
  }
}

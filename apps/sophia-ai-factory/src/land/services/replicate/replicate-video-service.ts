/**
 * ReplicateVideoService
 *
 * Implements IVideoService using the Replicate API (replicate.com) to run
 * a Wav2Lip model for lip-syncing audio to a face image.
 *
 * BYOK model: accepts user Replicate API key. No operator-managed keys required.
 *
 * Mapping from IVideoService to Wav2Lip:
 *   avatarId  → source face image URL
 *   voiceId   → source audio URL (voiceover)
 *   script    → narration text (stored as metadata, not sent to model)
 *
 * The output video is automatically downloaded to R2 when status reaches
 * "completed" during polling.
 */

import { IVideoService, CreateVideoParams, VideoStatus, Avatar, Voice } from '../types';
import { ProviderInvalidKeyError, ProviderQuotaExceededError, ProviderNetworkError } from '@/seed/services/errors';
import { logger } from '@/seed/utils/logger-utility';
import { getVideoBucket } from '@/land/video/storage/r2-binding';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://api.replicate.com/v1';
const DEFAULT_MODEL_OWNER = 'devxpy';
const DEFAULT_MODEL_NAME = 'wav2lip';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReplicateVideoServiceConfig {
  apiKey: string;
  baseUrl?: string;
  modelOwner?: string;
  modelName?: string;
  timeoutMs?: number;
}

type ReplicateJobStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';

interface ReplicatePrediction {
  id: string;
  status: ReplicateJobStatus;
  output?: string | string[];
  error?: string;
  metrics?: Record<string, unknown>;
}

interface ReplicateApiError {
  detail?: string;
  title?: string;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class ReplicateClientError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ReplicateClientError';
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ReplicateVideoService implements IVideoService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelOwner: string;
  private readonly modelName: string;
  private readonly timeoutMs: number;

  constructor(config: ReplicateVideoServiceConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.modelOwner = config.modelOwner ?? DEFAULT_MODEL_OWNER;
    this.modelName = config.modelName ?? DEFAULT_MODEL_NAME;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  // ─── createVideo ───────────────────────────────────────────────────────────

  async createVideo(params: CreateVideoParams): Promise<string> {
    const input: Record<string, unknown> = {
      face: params.avatarId,   // Source image URL with a face
      audio: params.voiceId,   // Audio file URL to lip-sync
    };

    logger.info('[ReplicateVideoService] Submitting Wav2Lip prediction', {
      model: `${this.modelOwner}/${this.modelName}`,
      hasFace: !!params.avatarId,
      hasAudio: !!params.voiceId,
      title: params.title,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        `${this.baseUrl}/models/${this.modelOwner}/${this.modelName}/predictions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ input }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const prediction = (await response.json()) as ReplicatePrediction;

      logger.info('[ReplicateVideoService] Prediction created', {
        predictionId: prediction.id,
        status: prediction.status,
      });

      return prediction.id;
    } catch (error) {
      if (error instanceof ReplicateClientError) throw error;
 if (error instanceof ProviderInvalidKeyError) throw error;
 if (error instanceof ProviderQuotaExceededError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ProviderNetworkError(
          'replicate',
          `Prediction submission timed out after ${this.timeoutMs}ms`,
        );
      }
      throw new ProviderNetworkError(
        'replicate',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── getVideoStatus ────────────────────────────────────────────────────────

  async getVideoStatus(videoId: string): Promise<VideoStatus> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/predictions/${videoId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const prediction = (await response.json()) as ReplicatePrediction;

      const status = this.mapStatus(prediction.status);
      const videoUrl = this.extractOutputUrl(prediction);

      let permanentUrl: string | undefined;

      // When the video is complete, download it to R2 for permanent storage
      if (status === 'completed' && videoUrl) {
        permanentUrl = await this.storeToR2(videoId, videoUrl);
      }

      return {
        id: videoId,
        status,
        video_url: permanentUrl ?? videoUrl,
        error: prediction.error,
      };
    } catch (error) {
      if (error instanceof ReplicateClientError) throw error;
 if (error instanceof ProviderInvalidKeyError) throw error;
 if (error instanceof ProviderQuotaExceededError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ProviderNetworkError(
          'replicate',
          `Status poll timed out after ${this.timeoutMs}ms`,
        );
      }
      throw new ProviderNetworkError(
        'replicate',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── listAvatars ───────────────────────────────────────────────────────────

  async listAvatars(): Promise<Avatar[]> {
    // Wav2Lip has no predefined avatars; users supply their own face image
    return [];
  }

  // ─── listVoices ────────────────────────────────────────────────────────────

  async listVoices(): Promise<Voice[]> {
    // Wav2Lip has no predefined voices; users supply their own audio file
    return [];
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private mapStatus(replicateStatus: ReplicateJobStatus): VideoStatus['status'] {
    switch (replicateStatus) {
      case 'starting':
      case 'processing':
        return 'processing';
      case 'succeeded':
        return 'completed';
      case 'failed':
      case 'canceled':
        return 'failed';
      default:
        return 'pending';
    }
  }

  private extractOutputUrl(prediction: ReplicatePrediction): string | undefined {
    if (!prediction.output) return undefined;
    return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  }

  /**
   * Download the completed video from Replicate's output URL and store it
   * permanently in Cloudflare R2. Falls back to the original URL if R2 is
   * unavailable (local dev, test, or transient outage).
   */
  private async storeToR2(videoId: string, sourceUrl: string): Promise<string> {
    const r2 = await getVideoBucket();

    if (!r2) {
      logger.warn('[ReplicateVideoService] R2 binding unavailable — using Replicate URL as fallback', {
        videoId,
      });
      return sourceUrl;
    }

    let response: Response;

    try {
      response = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(60_000), // 60s for download
      });
    } catch (err) {
      logger.error('[ReplicateVideoService] Failed to download video from Replicate URL', {
        videoId,
        error: err instanceof Error ? err.message : String(err),
      });
      return sourceUrl;
    }

    if (!response.ok) {
      logger.error('[ReplicateVideoService] Download failed', {
        videoId,
        status: response.status,
      });
      return sourceUrl;
    }

    const body = await response.arrayBuffer();
    const key = `replicate/${videoId}/${Date.now()}.mp4`;

    try {
      await r2.bucket.put(key, body, {
        httpMetadata: { contentType: 'video/mp4' },
      });
    } catch (err) {
      logger.error('[ReplicateVideoService] R2 upload failed', {
        videoId,
        key,
        error: err instanceof Error ? err.message : String(err),
      });
      return sourceUrl;
    }

    const permanentUrl = r2.publicBaseUrl
      ? `${r2.publicBaseUrl}/${key}`
      : sourceUrl;

    logger.info('[ReplicateVideoService] Video stored in R2', {
      videoId,
      key,
      sizeBytes: body.byteLength,
    });

    return permanentUrl;
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorBody: string;
    try {
      errorBody = await response.text();
    } catch {
      errorBody = '';
    }

    let parsed: ReplicateApiError | undefined;
    try {
      parsed = JSON.parse(errorBody) as ReplicateApiError;
    } catch {
      // ignore parse errors
    }

    const message = parsed?.detail ?? parsed?.title ?? errorBody;

    switch (response.status) {
      case 401:
      case 403:
        throw new ProviderInvalidKeyError('replicate', message);
      case 402:
        throw new ProviderQuotaExceededError('replicate', `Payment required: ${message}`);
      case 429:
        throw new ProviderQuotaExceededError('replicate', `Rate limited: ${message}`);
      default:
        throw new ReplicateClientError(
          response.status,
          `[ReplicateVideoService] API error ${response.status}: ${message}`,
        );
    }
  }
}

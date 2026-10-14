/**
 * KlingVideoClient class implementation
 *
 * @module land/video/generation/kling/client
 */

import type {
  VideoGenerateParams,
  VideoGenerateResult,
  ProviderVideoJobStatus,
} from '../../templates/types';
import {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  type KlingVideoClientConfig,
} from './types';
import { submitKlingVideoJob } from './job-submitter';
import { pollKlingJobStatus } from './job-poller';

export class KlingVideoClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor({ apiKey, baseUrl, timeoutMs }: KlingVideoClientConfig) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async generateVideo(
    params: VideoGenerateParams,
  ): Promise<VideoGenerateResult> {
    return submitKlingVideoJob(
      this.baseUrl,
      this.apiKey,
      this.timeoutMs,
      params,
    );
  }

  async getJobStatus(jobId: string): Promise<ProviderVideoJobStatus> {
    return pollKlingJobStatus(
      this.baseUrl,
      this.apiKey,
      this.timeoutMs,
      jobId,
    );
  }
}

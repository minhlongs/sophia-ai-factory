import type { VideoEngine } from './video-engine';
import type { VideoEngineCapabilities } from './video-engine-capabilities';
import type { VideoEngineResult, JobStatusResult } from './video-engine-result';
import type { CostEstimate } from './cost-estimate';
import type { TalkingHeadInput } from './talking-head-input';
import type { VoiceoverInput } from './voiceover-input';
import type { TextToVideoInput } from './text-to-video-input';
import { ProviderInvalidKeyError, ProviderQuotaExceededError, ProviderNetworkError, MissingCredentialsError } from '@/seed/services/errors';

const CAPABILITIES: VideoEngineCapabilities = {
  generationTypes: ['text_to_video'],
  maxDurationSeconds: 10,
  minDurationSeconds: 2,
  maxResolution: '1920x1080',
  outputFormats: ['mp4'],
  imageFormats: ['png', 'jpg'],
  audioFormats: [],
  realTime: false,
  batch: true,
  maxConcurrentJobs: 8,
  customAvatars: false,
  voiceCloning: false,
  lipSync: false,
};

export class CogVideoXAdapter implements VideoEngine {
  readonly id: VideoEngine['id'] = 'cogvideox';
  readonly label = 'CogVideoX';
  readonly capabilities = CAPABILITIES;

  constructor(
    private readonly getApiKey: (provider: string) => string | undefined,
    private readonly baseUrl?: string,
  ) {}

  async generateTextToVideo(input: TextToVideoInput): Promise<VideoEngineResult> {
    const apiKey = this.getApiKey('zhipu') ?? this.getApiKey('openai');
    if (!apiKey && !this.baseUrl) throw new MissingCredentialsError('zhipu (or openai for self-hosted)');
    const url = this.baseUrl
      ? `${this.baseUrl}/v1/videos/generations`
      : 'https://open.bigmodel.cn/api/paas/v4/videos/generations';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'CogVideoX-5a',
          prompt: input.prompt,
          negative_prompt: input.negativePrompt,
          aspect_ratio: input.aspectRatio,
          duration_seconds: input.durationSeconds,
          cfg_scale: input.cfgScale,
          seed: input.seed,
          reference_image: input.referenceImageUrl,
          output_format: input.outputFormat,
        }),
        signal: controller.signal,
      });
      return await this.handleCreateResponse(res);
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateTalkingHead(_input: TalkingHeadInput): Promise<VideoEngineResult> {
    throw new Error('[CogVideoX] talking_head is not supported — this engine only does text-to-video');
  }

  async generateVoiceover(_input: VoiceoverInput): Promise<VideoEngineResult> {
    throw new Error('[CogVideoX] voiceover is not supported — this engine only does text-to-video');
  }

  async getJobStatus(jobId: string): Promise<JobStatusResult> {
    const apiKey = this.getApiKey('zhipu') ?? this.getApiKey('openai');
    const url = this.baseUrl
      ? `${this.baseUrl}/v1/videos/generations/${encodeURIComponent(jobId)}`
      : `https://open.bigmodel.cn/api/paas/v4/videos/generations/${encodeURIComponent(jobId)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey ?? ''}` } });
    return this.handleStatusResponse(res);
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const apiKey = this.getApiKey('zhipu') ?? this.getApiKey('openai');
    const url = this.baseUrl
      ? `${this.baseUrl}/v1/videos/generations/${encodeURIComponent(jobId)}/cancel`
      : `https://open.bigmodel.cn/api/paas/v4/videos/generations/${encodeURIComponent(jobId)}/cancel`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey ?? ''}` },
    });
    if (!res.ok) this.throwFromStatus(res.status, res.statusText);
    return true;
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; details?: Record<string, unknown> }> {
    const start = Date.now();
    try {
      const apiKey = this.getApiKey('zhipu') ?? this.getApiKey('openai');
      const url = this.baseUrl
        ? `${this.baseUrl}/health`
        : 'https://open.bigmodel.cn/api/paas/v4/models';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey ?? ''}` },
        signal: AbortSignal.timeout(5_000),
      });
      const latency = Date.now() - start;
      return { healthy: res.ok, latencyMs: latency, details: res.ok ? undefined : { status: res.status } };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }

  async estimateCost(
    input: { type: 'talking_head' | 'voiceover' | 'text_to_video'; params: TalkingHeadInput | VoiceoverInput | TextToVideoInput },
  ): Promise<CostEstimate> {
    if (input.type !== 'text_to_video') {
      return { amount: 0, unit: 'usd', confidence: 'unavailable' };
    }
    const params = input.params as TextToVideoInput;
    const duration = params.durationSeconds ?? 5;
    const rate = 0.15;
    return {
      amount: duration * rate,
      unit: 'usd',
      confidence: 'estimated',
      breakdown: { per_second: rate, duration },
    };
  }

  private async handleCreateResponse(res: Response): Promise<VideoEngineResult> {
    if (res.status === 401 || res.status === 403) {
      throw new ProviderInvalidKeyError('cogvideox', `HTTP ${res.status}`);
    }
    if (res.status === 429) {
      throw new ProviderQuotaExceededError('cogvideox', 'Rate limited');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderNetworkError('cogvideox', `HTTP ${res.status}: ${body}`);
    }
    const body = (await res.json()) as {
      id?: string; task_status?: string; request_id?: string; video?: Array<{ url?: string }>;
    };
    if (body.task_status === 'FAIL') {
      throw new ProviderNetworkError('cogvideox', 'Generation failed — check prompt and try again');
    }
    return {
      jobId: body.id ?? body.request_id ?? '',
      estimatedDuration: 120,
      synchronous: false,
      videoUrl: body.video?.[0]?.url,
    };
  }

  private async handleStatusResponse(res: Response): Promise<JobStatusResult> {
    if (!res.ok) this.throwFromStatus(res.status, res.statusText);
    const body = (await res.json()) as {
      task_status: string; request_id: string;
      video_result?: Array<{ url?: string; cover_url?: string }>;
      task_status_msg?: string;
    };
    const statusMap: Record<string, JobStatusResult['status']> = {
      SUCCESS: 'completed', FAIL: 'failed', PROCESSING: 'processing', PENDING: 'queued',
    };
    return {
      status: statusMap[body.task_status] ?? 'processing',
      videoUrl: body.video_result?.[0]?.url,
      thumbnailUrl: body.video_result?.[0]?.cover_url,
      error: body.task_status_msg,
      completedAt: body.task_status === 'SUCCESS' ? new Date().toISOString() : undefined,
    };
  }

  private throwFromStatus(status: number, text: string): never {
    if (status === 401 || status === 403) throw new ProviderInvalidKeyError('cogvideox', text);
    if (status === 429) throw new ProviderQuotaExceededError('cogvideox', text);
    throw new ProviderNetworkError('cogvideox', `HTTP ${status}: ${text}`);
  }
}

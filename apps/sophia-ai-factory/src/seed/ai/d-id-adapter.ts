import type { VideoEngine } from './video-engine';
import type { VideoEngineCapabilities } from './video-engine-capabilities';
import type { VideoEngineResult, JobStatusResult } from './video-engine-result';
import type { CostEstimate } from './cost-estimate';
import type { TalkingHeadInput } from './talking-head-input';
import type { VoiceoverInput } from './voiceover-input';
import type { TextToVideoInput } from './text-to-video-input';
import { ProviderInvalidKeyError, ProviderQuotaExceededError, ProviderNetworkError, MissingCredentialsError } from '@/seed/services/errors';

const D_ID_BASE_URL = 'https://api.d-id.com';

const CAPABILITIES: VideoEngineCapabilities = {
  generationTypes: ['talking_head', 'voiceover'],
  maxDurationSeconds: 300,
  minDurationSeconds: 1,
  maxResolution: '1920x1080',
  outputFormats: ['mp4'],
  imageFormats: ['png', 'jpg'],
  audioFormats: ['mp3', 'wav'],
  realTime: false,
  batch: true,
  maxConcurrentJobs: 10,
  customAvatars: true,
  voiceCloning: true,
  lipSync: true,
};

export class DIdAdapter implements VideoEngine {
  readonly id: VideoEngine['id'] = 'd-id';
  readonly label = 'D-ID';
  readonly capabilities = CAPABILITIES;

  constructor(
    private readonly getApiKey: (provider: string) => string | undefined,
    private readonly baseUrl: string = D_ID_BASE_URL,
  ) {}

  async generateTalkingHead(input: TalkingHeadInput): Promise<VideoEngineResult> {
    const apiKey = this.getApiKey('d-id');
    if (!apiKey) throw new MissingCredentialsError('d-id');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const sourceImage = input.avatarImageData ?? input.avatarImageUrl;
      if (!sourceImage) throw new Error('[D-ID] avatarImageUrl or avatarImageData required');

      const res = await fetch(`${this.baseUrl}/talks`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          source_url: sourceImage,
          script: {
            type: 'text',
            input: input.script,
            provider: { type: 'microsoft', voice_id: input.voiceId ?? 'en-US-JennyNeural' },
          },
          config: {
            fluent: true,
            pad_audio: 0.5,
            align_driver: true,
          },
        }),
        signal: controller.signal,
      });
      return await this.handleCreateResponse(res);
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateVoiceover(input: VoiceoverInput): Promise<VideoEngineResult> {
    const apiKey = this.getApiKey('d-id');
    if (!apiKey) throw new MissingCredentialsError('d-id');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch(`${this.baseUrl}/audio`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          script: { type: 'text', input: input.script, provider: { type: 'microsoft', voice_id: input.voiceId } },
          config: { output_format: input.outputFormat ?? 'mp3' },
        }),
        signal: controller.signal,
      });
      return await this.handleVoiceoverResponse(res);
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateTextToVideo(_input: TextToVideoInput): Promise<VideoEngineResult> {
    throw new Error('[D-ID] text_to_video not supported — use CogVideoX instead');
  }

  async getJobStatus(jobId: string): Promise<JobStatusResult> {
    const apiKey = this.getApiKey('d-id');
    if (!apiKey) throw new MissingCredentialsError('d-id');
    const res = await fetch(`${this.baseUrl}/talks/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Basic ${apiKey}`, Accept: 'application/json' },
    });
    if (!res.ok) this.throwFromStatus(res.status, res.statusText);
    const body = (await res.json()) as {
      status: string; duration?: number; result_url?: string; error?: { description?: string };
    };
    const statusMap: Record<string, JobStatusResult['status']> = {
      done: 'completed', error: 'failed', started: 'processing', waiting: 'queued',
    };
    return {
      status: statusMap[body.status] ?? 'processing',
      videoUrl: body.result_url,
      error: body.error?.description,
      completedAt: body.status === 'done' ? new Date().toISOString() : undefined,
    };
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const apiKey = this.getApiKey('d-id');
    if (!apiKey) throw new MissingCredentialsError('d-id');
    const res = await fetch(`${this.baseUrl}/talks/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Basic ${apiKey}` },
    });
    if (res.status === 404) return false;
    if (!res.ok) this.throwFromStatus(res.status, res.statusText);
    return true;
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; details?: Record<string, unknown> }> {
    const start = Date.now();
    try {
      const apiKey = this.getApiKey('d-id');
      const res = await fetch(`${this.baseUrl}/account`, {
        headers: { Authorization: `Basic ${apiKey ?? ''}` },
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
    if (input.type === 'text_to_video') {
      return { amount: 0, unit: 'usd', confidence: 'unavailable' };
    }
    if (input.type === 'talking_head') {
      return { amount: 0.05, unit: 'usd', confidence: 'estimated' };
    }
    return { amount: 0.03, unit: 'usd', confidence: 'estimated' };
  }

  private async handleCreateResponse(res: Response): Promise<VideoEngineResult> {
    if (res.status === 401 || res.status === 403) {
      throw new ProviderInvalidKeyError('d-id', `HTTP ${res.status}`);
    }
    if (res.status === 402) {
      throw new ProviderQuotaExceededError('d-id', 'Insufficient credits');
    }
    if (res.status === 429) {
      throw new ProviderQuotaExceededError('d-id', 'Rate limited');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderNetworkError('d-id', `HTTP ${res.status}: ${body}`);
    }
    const body = (await res.json()) as { id?: string; status?: string; duration?: number; result_url?: string };
    return {
      jobId: body.id ?? '',
      estimatedDuration: body.duration ?? 30,
      synchronous: body.status === 'done',
      videoUrl: body.result_url,
    };
  }

  private async handleVoiceoverResponse(res: Response): Promise<VideoEngineResult> {
    if (res.status === 401 || res.status === 403) {
      throw new ProviderInvalidKeyError('d-id', `HTTP ${res.status}`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderNetworkError('d-id', `HTTP ${res.status}: ${body}`);
    }
    const body = (await res.json()) as { id?: string; status?: string; result_url?: string };
    return {
      jobId: body.id ?? '',
      estimatedDuration: 10,
      synchronous: body.status === 'done',
      audioUrl: body.result_url,
    };
  }

  private throwFromStatus(status: number, text: string): never {
    if (status === 401 || status === 403) throw new ProviderInvalidKeyError('d-id', text);
    if (status === 402 || status === 429) throw new ProviderQuotaExceededError('d-id', text);
    throw new ProviderNetworkError('d-id', `HTTP ${status}: ${text}`);
  }
}

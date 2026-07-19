import type { VideoEngine } from './video-engine';
import type { VideoEngineCapabilities } from './video-engine-capabilities';
import type { VideoEngineResult, JobStatusResult } from './video-engine-result';
import type { CostEstimate } from './cost-estimate';
import type { TalkingHeadInput } from './talking-head-input';
import type { VoiceoverInput } from './voiceover-input';
import type { TextToVideoInput } from './text-to-video-input';
import { ProviderInvalidKeyError, ProviderQuotaExceededError, ProviderNetworkError, MissingCredentialsError } from '@/seed/services/errors';

const DUIX_BASE_URL = 'https://api.duix.ai/v1';

const CAPABILITIES: VideoEngineCapabilities = {
  generationTypes: ['talking_head', 'voiceover'],
  maxDurationSeconds: 180,
  minDurationSeconds: 1,
  maxResolution: '1920x1080',
  outputFormats: ['mp4'],
  imageFormats: ['png', 'jpg'],
  audioFormats: ['mp3', 'wav'],
  realTime: false,
  batch: true,
  maxConcurrentJobs: 20,
  customAvatars: true,
  voiceCloning: true,
  lipSync: true,
};

export class DuixAvatarAdapter implements VideoEngine {
  readonly id: VideoEngine['id'] = 'duix-avatar';
  readonly label = 'Duix-Avatar';
  readonly capabilities = CAPABILITIES;

  constructor(
    private readonly getApiKey: (provider: string) => string | undefined,
    private readonly baseUrl: string = DUIX_BASE_URL,
  ) {}

  async generateTalkingHead(input: TalkingHeadInput): Promise<VideoEngineResult> {
    const apiKey = this.getApiKey('duix-avatar');
    if (!apiKey) throw new MissingCredentialsError('duix-avatar');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetch(`${this.baseUrl}/avatars/talks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          avatar_id: input.avatarId,
          script: input.script,
          voice_id: input.voiceId,
          language: input.language,
          resolution: input.resolution ?? '1920x1080',
          output_format: input.outputFormat ?? 'mp4',
          expression: input.expression ?? 'neutral',
          subtitles_enabled: input.subtitles?.enabled ?? false,
          background_music_url: input.backgroundMusicUrl,
        }),
        signal: controller.signal,
      });
      return await this.handleTalkingHeadResponse(res);
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateVoiceover(input: VoiceoverInput): Promise<VideoEngineResult> {
    const apiKey = this.getApiKey('duix-avatar');
    if (!apiKey) throw new MissingCredentialsError('duix-avatar');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch(`${this.baseUrl}/voice/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          text: input.script,
          voice_id: input.voiceId,
          language: input.language,
          output_format: input.outputFormat ?? 'mp3',
          speaking_rate: input.speakingRate ?? 1.0,
          pitch: input.pitch ?? 0,
          stability: input.stability ?? 0.5,
          ssml: input.ssml,
          max_duration_seconds: input.maxDurationSeconds,
        }),
        signal: controller.signal,
      });
      return await this.handleVoiceoverResponse(res);
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateTextToVideo(_input: TextToVideoInput): Promise<VideoEngineResult> {
    throw new Error('[Duix-Avatar] text_to_video is not supported by this engine');
  }

  async getJobStatus(jobId: string): Promise<JobStatusResult> {
    const apiKey = this.getApiKey('duix-avatar');
    if (!apiKey) throw new MissingCredentialsError('duix-avatar');
    const res = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
    if (!res.ok) this.throwFromStatus(res.status, res.statusText);
    const body = (await res.json()) as {
      status: string; result_url?: string; video_url?: string;
      audio_url?: string; thumbnail_url?: string; error?: string; progress?: number; completed_at?: string;
    };
    const statusMap: Record<string, JobStatusResult['status']> = {
      completed: 'completed', failed: 'failed', processing: 'processing',
      queued: 'queued', cancelled: 'cancelled',
    };
    return {
      status: statusMap[body.status] ?? 'processing',
      progressPercent: body.progress,
      videoUrl: body.video_url ?? body.result_url,
      audioUrl: body.audio_url,
      thumbnailUrl: body.thumbnail_url,
      error: body.error,
      completedAt: body.completed_at,
    };
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const apiKey = this.getApiKey('duix-avatar');
    if (!apiKey) throw new MissingCredentialsError('duix-avatar');
    const res = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 404) return false;
    if (!res.ok) this.throwFromStatus(res.status, res.statusText);
    return true;
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; details?: Record<string, unknown> }> {
    const start = Date.now();
    try {
      const apiKey = this.getApiKey('duix-avatar');
      const res = await fetch(`${this.baseUrl}/avatars`, {
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
    if (input.type === 'text_to_video') {
      return { amount: 0, unit: 'usd', confidence: 'unavailable' };
    }
    if (input.type === 'voiceover') {
      const wordCount = (input.params as VoiceoverInput).script.split(/\s+/).length;
      const estimatedSeconds = Math.max(1, Math.ceil(wordCount / 2.5));
      return { amount: estimatedSeconds * 0.04, unit: 'usd', confidence: 'estimated' };
    }
    const wordCount = (input.params as TalkingHeadInput).script.split(/\s+/).length;
    const estimatedSeconds = Math.max(1, Math.ceil(wordCount / 2.5));
    return { amount: estimatedSeconds * 0.06, unit: 'usd', confidence: 'estimated' };
  }

  private async handleTalkingHeadResponse(res: Response): Promise<VideoEngineResult> {
    if (res.status === 401 || res.status === 403) {
      throw new ProviderInvalidKeyError('duix-avatar', `HTTP ${res.status}`);
    }
    if (res.status === 429) {
      throw new ProviderQuotaExceededError('duix-avatar', 'Rate limited');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderNetworkError('duix-avatar', `HTTP ${res.status}: ${body}`);
    }
    const body = (await res.json()) as { job_id?: string; status?: string; video_url?: string; error?: string };
    if (body.error) throw new ProviderNetworkError('duix-avatar', body.error);
    return {
      jobId: body.job_id ?? '',
      estimatedDuration: 30,
      synchronous: body.status === 'completed',
      videoUrl: body.video_url,
    };
  }

  private async handleVoiceoverResponse(res: Response): Promise<VideoEngineResult> {
    if (res.status === 401 || res.status === 403) {
      throw new ProviderInvalidKeyError('duix-avatar', `HTTP ${res.status}`);
    }
    if (res.status === 429) {
      throw new ProviderQuotaExceededError('duix-avatar', 'Rate limited');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderNetworkError('duix-avatar', `HTTP ${res.status}: ${body}`);
    }
    const body = (await res.json()) as { job_id?: string; status?: string; audio_url?: string; error?: string };
    if (body.error) throw new ProviderNetworkError('duix-avatar', body.error);
    return {
      jobId: body.job_id ?? '',
      estimatedDuration: 10,
      synchronous: body.status === 'completed',
      audioUrl: body.audio_url,
    };
  }

  private throwFromStatus(status: number, text: string): never {
    if (status === 401 || status === 403) throw new ProviderInvalidKeyError('duix-avatar', text);
    if (status === 429) throw new ProviderQuotaExceededError('duix-avatar', text);
    throw new ProviderNetworkError('duix-avatar', `HTTP ${status}: ${text}`);
  }
}

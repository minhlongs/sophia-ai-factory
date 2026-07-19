import type { VideoEngine } from './video-engine';
import type { VideoEngineCapabilities } from './video-engine-capabilities';
import type { VideoEngineResult, JobStatusResult } from './video-engine-result';
import type { CostEstimate } from './cost-estimate';
import type { TalkingHeadInput } from './talking-head-input';
import type { VoiceoverInput } from './voiceover-input';
import type { TextToVideoInput } from './text-to-video-input';
import { ProviderNetworkError, MissingCredentialsError } from '@/seed/services/errors';

const SADTALKER_BASE_URL = 'http://localhost:8000';

const CAPABILITIES: VideoEngineCapabilities = {
  generationTypes: ['talking_head', 'text_to_video'],
  maxDurationSeconds: 60,
  minDurationSeconds: 2,
  maxResolution: '512x512',
  outputFormats: ['mp4'],
  imageFormats: ['png', 'jpg'],
  audioFormats: ['mp3'],
  realTime: false,
  batch: true,
  maxConcurrentJobs: 4,
  customAvatars: true,
  voiceCloning: false,
  lipSync: true,
};

export class SadTalkerAdapter implements VideoEngine {
  readonly id: VideoEngine['id'] = 'sadtalker';
  readonly label = 'SadTalker';
  readonly capabilities = CAPABILITIES;

  constructor(
    private readonly getApiKey: (provider: string) => string | undefined,
    private readonly baseUrl: string = SADTALKER_BASE_URL,
  ) {}

  async generateTalkingHead(input: TalkingHeadInput): Promise<VideoEngineResult> {
    const sourceImage = input.avatarImageData ?? input.avatarImageUrl;
    if (!sourceImage) throw new Error('[SadTalker] avatarImageData or avatarImageUrl is required');

    const useAsync = input.maxDurationSeconds && input.maxDurationSeconds > 15;
    if (useAsync) {
      return this.submitJob('talking_head', { sourceImage, audio: input.script, voiceId: input.voiceId });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const form = new FormData();
      form.append('source_image', this.toBlob(sourceImage, input.avatarImageFormat ?? 'image/png'));
      form.append('audio', this.toAudioBlob(input.script, input.voiceId));
      const res = await fetch(`${this.baseUrl}/talks`, {
        method: 'POST', body: form as unknown as BodyInit, signal: controller.signal,
      });
      return await this.handleSyncResponse(res);
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateVoiceover(_input: VoiceoverInput): Promise<VideoEngineResult> {
    throw new Error('[SadTalker] voiceover generation is not supported — use ElevenLabs instead');
  }

  async generateTextToVideo(input: TextToVideoInput): Promise<VideoEngineResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: input.prompt,
          negative_prompt: input.negativePrompt,
          style: input.style,
          aspect_ratio: input.aspectRatio,
          duration: input.durationSeconds,
          seed: input.seed,
          cfg_scale: input.cfgScale,
        }),
        signal: controller.signal,
      });
      return await this.handleSyncResponse(res);
    } finally {
      clearTimeout(timeout);
    }
  }

  async getJobStatus(jobId: string): Promise<JobStatusResult> {
    const res = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(jobId)}/status`);
    if (!res.ok) this.throwFromStatus(res.status, res.statusText);
    const body = (await res.json()) as { status: string; video_url?: string; error?: string; progress?: number };
    const statusMap: Record<string, JobStatusResult['status']> = {
      completed: 'completed', failed: 'failed', processing: 'processing', queued: 'queued',
    };
    return {
      status: statusMap[body.status] ?? 'processing',
      progressPercent: body.progress,
      videoUrl: body.video_url,
      error: body.error,
      completedAt: body.status === 'completed' ? new Date().toISOString() : undefined,
    };
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
    if (!res.ok) this.throwFromStatus(res.status, res.statusText);
    return true;
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; details?: Record<string, unknown> }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(5_000) });
      const latency = Date.now() - start;
      return { healthy: res.ok, latencyMs: latency, details: res.ok ? undefined : { status: res.status } };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }

  async estimateCost(
    input: { type: 'talking_head' | 'voiceover' | 'text_to_video'; params: TalkingHeadInput | VoiceoverInput | TextToVideoInput },
  ): Promise<CostEstimate> {
    if (input.type === 'voiceover') {
      return { amount: 0, unit: 'usd', confidence: 'unavailable' };
    }
    const baseRate = input.type === 'text_to_video' ? 0.10 : 0.01;
    return { amount: baseRate, unit: 'usd', confidence: 'estimated' };
  }

  private async submitJob(type: 'talking_head' | 'text_to_video', payload: Record<string, unknown>): Promise<VideoEngineResult> {
    const res = await fetch(`${this.baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...payload }),
    });
    if (!res.ok) this.throwFromStatus(res.status, res.statusText);
    const body = (await res.json()) as { job_id: string };
    return { jobId: body.job_id, estimatedDuration: 30, synchronous: false };
  }

  private async handleSyncResponse(res: Response): Promise<VideoEngineResult> {
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderNetworkError('sadtalker', `HTTP ${res.status}: ${body}`);
    }
    const body = (await res.json()) as { video_url?: string; error?: string };
    if (body.error) throw new ProviderNetworkError('sadtalker', body.error);
    return { jobId: '', estimatedDuration: 10, synchronous: true, videoUrl: body.video_url };
  }

  private throwFromStatus(status: number, text: string): never {
    throw new ProviderNetworkError('sadtalker', `HTTP ${status}: ${text}`);
  }

  private toBlob(dataUrl: string, _mime: string): Blob {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('[SadTalker] invalid image data URI');
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: match[1] });
  }

  private toAudioBlob(_script: string, _voiceId?: string): Blob {
    return new Blob([], { type: 'audio/wav' });
  }
}

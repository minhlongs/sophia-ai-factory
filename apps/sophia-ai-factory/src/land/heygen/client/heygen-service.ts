import { Tier } from '@/seed/types';
import { getErrorMessage } from '@/seed/utils/to-error';
import { trackUsage, calculateCredits, startTimer } from '@/tree/usage-metering';
import { sendHeyGenRequest } from './http-transport';
import {
  HeyGenAvatar,
  HeyGenVoice,
  HeyGenVideoStatus,
  HeyGenVideoStatusResponse,
} from './types';

export class HeyGenClient {
  private apiKey: string;
  private tier: Tier;
  private userId: string;
  private licenseNonce: string;
  private licenseKeyHash: string;

  constructor(
    apiKey: string,
    tier: Tier = 'BASIC',
    userId: string = 'unknown',
    licenseNonce: string = 'unknown',
    licenseKeyHash: string = ''
  ) {
    this.apiKey = apiKey;
    this.tier = tier;
    this.userId = userId;
    this.licenseNonce = licenseNonce;
    this.licenseKeyHash = licenseKeyHash;
  }

  private async request<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return sendHeyGenRequest<T>(this.apiKey, endpoint, options);
  }

  async listAvatars(): Promise<HeyGenAvatar[]> {
    try {
      const data = await this.request<{ data?: { avatars?: HeyGenAvatar[] } | HeyGenAvatar[] }>('/avatars');
      const inner = data?.data;
      if (inner && Array.isArray(inner)) return inner;
      return (inner as { avatars?: HeyGenAvatar[] })?.avatars ?? [];
    } catch {
      return [];
    }
  }

  async listVoices(): Promise<HeyGenVoice[]> {
    try {
      const data = await this.request<{ data?: { voices?: HeyGenVoice[] } | HeyGenVoice[] }>('/voices');
      const inner = data?.data;
      if (inner && Array.isArray(inner)) return inner;
      return (inner as { voices?: HeyGenVoice[] })?.voices ?? [];
    } catch {
      return [];
    }
  }

  async createVideo(params: {
    avatarId: string;
    voiceId: string;
    script: string;
    title?: string;
  }): Promise<string> {
    const stopTimer = startTimer();
    const body = {
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: params.avatarId,
            avatar_style: 'normal',
          },
          voice: {
            type: 'text',
            input_text: params.script,
            voice_id: params.voiceId,
          },
        },
      ],
      dimension: {
        width: 1920,
        height: 1080,
      },
      title: params.title,
    };

    try {
      const data = await this.request<{ data?: { video_id?: string } }>('/video/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const videoId = data?.data?.video_id;
      if (!videoId) {
        throw new Error('HeyGen API: missing video_id in response');
      }

      await trackUsage({
        userId: this.userId,
        licenseKeyHash: this.licenseKeyHash,
        licenseNonce: this.licenseNonce,
        service: 'heygen',
        endpoint: '/video/generate',
        action: 'create_video',
        creditsUsed: calculateCredits('heygen', 'createVideo', undefined, this.tier),
        requestId: videoId,
        tierAtRequest: this.tier,
        statusCode: 200,
        responseTimeMs: stopTimer(),
      });

      return videoId;
    } catch (error) {
      await trackUsage({
        userId: this.userId,
        licenseKeyHash: this.licenseKeyHash,
        licenseNonce: this.licenseNonce,
        service: 'heygen',
        endpoint: '/video/generate',
        action: 'create_video',
        tierAtRequest: this.tier,
        errorMessage: getErrorMessage(error),
        responseTimeMs: stopTimer(),
        creditsUsed: 0,
      });
      throw error;
    }
  }

  async getVideoStatus(videoId: string): Promise<HeyGenVideoStatus> {
    const data = await this.request<HeyGenVideoStatusResponse>(`/video/${videoId}`);
    const status = data.data?.status;

    return {
      id: videoId,
      status: status ?? 'pending',
      video_url: data.data?.video_url,
      thumbnail_url: data.data?.thumbnail_url,
      error: data.data?.error?.message,
    };
  }
}

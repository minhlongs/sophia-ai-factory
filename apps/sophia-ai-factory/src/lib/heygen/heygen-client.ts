
import { Tier } from "@/types";
import { trackUsage, hashLicenseKey, calculateCredits, startTimer } from '@/lib/usage-metering';
import { getUsageContext } from '@/lib/usage-metering/context';

const HEYGEN_API_URL = "https://api.heygen.com/v2";

export interface HeyGenAvatar {
  avatar_id: string;
  name: string;
  preview_image_url: string;
  gender: string;
}

export interface HeyGenVoice {
  voice_id: string;
  name: string;
  gender: string;
  language: string;
  preview_audio: string;
}

export interface HeyGenVideoStatus {
  status: "processing" | "completed" | "failed" | "pending";
  video_url?: string;
  thumbnail_url?: string;
  error?: string;
  id: string;
}

export class HeyGenClient {
  private apiKey: string;
  private tier: Tier;
  private userId: string;
  private licenseNonce: string;
  private licenseKeyHash: string;

  constructor(apiKey: string, tier: Tier = 'BASIC', userId: string = 'unknown', licenseNonce: string = 'unknown', licenseKeyHash: string = '') {
    this.apiKey = apiKey;
    this.tier = tier;
    this.userId = userId;
    this.licenseNonce = licenseNonce;
    this.licenseKeyHash = licenseKeyHash;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${HEYGEN_API_URL}${endpoint}`, {
      ...options,
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HeyGen API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response.json();
  }

  async listAvatars(): Promise<HeyGenAvatar[]> {
    try {
      const data = await this.request("/avatars");
      return data?.data?.avatars || data?.data || [];
    } catch {
      return [];
    }
  }

  async listVoices(): Promise<HeyGenVoice[]> {
    try {
      const data = await this.request("/voices");
      return data?.data?.voices || data?.data || [];
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
            type: "avatar",
            avatar_id: params.avatarId,
            avatar_style: "normal",
          },
          voice: {
            type: "text",
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
      const data = await this.request("/video/generate", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const videoId = data?.data?.video_id;
      if (!videoId) {
        throw new Error(`HeyGen API: missing video_id in response`);
      }

      // Track successful usage
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
      // Track failed usage
      await trackUsage({
        userId: this.userId,
        licenseKeyHash: this.licenseKeyHash,
        licenseNonce: this.licenseNonce,
        service: 'heygen',
        endpoint: '/video/generate',
        action: 'create_video',
        tierAtRequest: this.tier,
        errorMessage: error instanceof Error ? error.message : String(error),
        responseTimeMs: stopTimer(),
        creditsUsed: 0,
      });
      throw error;
    }
  }

  async getVideoStatus(videoId: string): Promise<HeyGenVideoStatus> {
    // Use v2 endpoint
    const data = await this.request(`/video/${videoId}`);
    const status = data.data?.status;

    return {
      id: videoId,
      status: status,
      video_url: data.data?.video_url,
      thumbnail_url: data.data?.thumbnail_url,
      error: data.data?.error?.message
    };
  }
}

// Singleton instance getter
let heygenClientInstance: HeyGenClient | null = null;

export function getHeyGenClient(): HeyGenClient | null {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return null;
  }

  if (!heygenClientInstance) {
    heygenClientInstance = new HeyGenClient(apiKey);
  }
  return heygenClientInstance;
}

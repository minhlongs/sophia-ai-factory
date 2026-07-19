
import { Tier } from "@/seed/types";
import { getErrorMessage } from '@/seed/utils/to-error';
import { trackUsage, hashLicenseKey, calculateCredits, startTimer } from '@/forest/usage-metering';
import { getUsageContext } from '@/forest/usage-metering/context';
import { ProviderQuotaExceededError, ProviderInvalidKeyError } from '@/land/services/errors';

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

interface HeyGenVideoStatusResponse {
  data?: {
    status?: HeyGenVideoStatus['status'];
    video_url?: string;
    thumbnail_url?: string;
    error?: { message?: string };
  };
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
      if (response.status === 401 || response.status === 403) {
        throw new ProviderInvalidKeyError('heygen', errorBody);
      }
      if (response.status === 429 || response.status === 402) {
        throw new ProviderQuotaExceededError('heygen', errorBody);
      }
      throw new Error(`HeyGen API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response.json();
  }

  async listAvatars(): Promise<HeyGenAvatar[]> {
    try {
      const data = (await this.request("/avatars")) as { data?: { avatars?: HeyGenAvatar[] } | HeyGenAvatar[] };
      const inner = data?.data;
      if (inner && Array.isArray(inner)) return inner;
      return inner?.avatars ?? [];
    } catch {
      return [];
    }
  }

  async listVoices(): Promise<HeyGenVoice[]> {
    try {
      const data = (await this.request("/voices")) as { data?: { voices?: HeyGenVoice[] } | HeyGenVoice[] };
      const inner = data?.data;
      if (inner && Array.isArray(inner)) return inner;
      return inner?.voices ?? [];
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
      const data = (await this.request("/video/generate", {
        method: "POST",
        body: JSON.stringify(body),
      })) as { data?: { video_id?: string } };

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
        errorMessage: getErrorMessage(error),
        responseTimeMs: stopTimer(),
        creditsUsed: 0,
      });
      throw error;
    }
  }

  async getVideoStatus(videoId: string): Promise<HeyGenVideoStatus> {
    // Use v2 endpoint
    const data = (await this.request(`/video/${videoId}`)) as HeyGenVideoStatusResponse;
    const status = data.data?.status;

    return {
      id: videoId,
      status: status ?? 'pending',
      video_url: data.data?.video_url,
      thumbnail_url: data.data?.thumbnail_url,
      error: data.data?.error?.message
    };
  }
}

import { getUserApiKey } from '@/tree/byok/user-api-key-store';
import { isByokEnabled } from '@/tree/byok/resolve-user-api-key';

/**
 * Returns a HeyGenClient resolved via BYOK when possible.
 *
 * Resolution order:
 *   1. userId provided AND BYOK enabled → user's stored heygen key (getUserApiKey)
 *   2. userId provided, no user key     → env HEYGEN_API_KEY fallback
 *   3. no userId                        → env HEYGEN_API_KEY (cron / system path)
 *   4. no key at all                    → null (caller falls back to mock)
 *
 * Note: 'heygen' is stored in user_api_keys with provider='heygen' (ByokProvider union widened Phase 03).
 *
 * No singleton — each call may resolve a different key per user.
 */
export async function getHeyGenClient(userId?: string): Promise<HeyGenClient | null> {
  const envKey = process.env.HEYGEN_API_KEY ?? null;

  if (userId && isByokEnabled()) {
    const userKey = await getUserApiKey(userId, 'heygen');
    const apiKey = userKey ?? envKey;
    if (!apiKey) return null;
    return new HeyGenClient(apiKey);
  }

  if (!envKey) return null;
  return new HeyGenClient(envKey);
}

// getHeyGenClientSync removed — P0.3 fix.
// All callers must use async getHeyGenClient({ userId }) to avoid platform key billing.

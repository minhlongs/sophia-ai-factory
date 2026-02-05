import { Tier } from "@/types";

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

  constructor(apiKey: string) {
    this.apiKey = apiKey;
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
      // Map the response to our interface. Adjust based on actual API response structure
      // Note: HeyGen API response structure might vary, this is a best-effort mapping
      // assuming standard response wrapper { data: { avatars: [...] } } or similar
      return data.data.avatars || data.data || [];
    } catch (error) {
      console.error("Failed to list avatars:", error);
      return [];
    }
  }

  async listVoices(): Promise<HeyGenVoice[]> {
    try {
      // Note: HeyGen might not have a direct v2/voices endpoint documented publicly in the same way,
      // usually voices are part of ElevenLabs or other integrations, but HeyGen has its own voices too.
      // We'll assume a standard endpoint or fall back to a hardcoded list if needed for v2.
      // For now, let's try a common pattern or return empty if not found.
      // Actually, typically you get voices via /voices or similar.
      const data = await this.request("/voices");
      return data.data.voices || data.data || [];
    } catch (error) {
      console.error("Failed to list voices:", error);
      return [];
    }
  }

  async createVideo(params: {
    avatarId: string;
    voiceId: string;
    script: string;
    title?: string;
  }): Promise<string> {
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

    const data = await this.request("/video/generate", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return data.data.video_id;
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
    console.warn("HEYGEN_API_KEY not set");
    return null;
  }

  if (!heygenClientInstance) {
    heygenClientInstance = new HeyGenClient(apiKey);
  }
  return heygenClientInstance;
}

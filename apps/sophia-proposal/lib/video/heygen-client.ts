/**
 * HeyGen API Client
 *
 * Wrapper for HeyGen video generation API
 * Docs: https://docs.heygen.com/
 */

import type {
  VideoGenerationRequest,
  VideoGenerationResponse,
  HeyGenTaskResponse,
  HeyGenAvatar,
  HeyGenVoice,
} from "@/types/video";

/**
 * HeyGen API configuration
 */
const HEYGEN_BASE_URL = process.env.HEYGEN_API_URL || "https://api.heygen.com/v1";
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

if (!HEYGEN_API_KEY) {
  console.warn("HEYGEN_API_KEY not configured - video generation will fail");
}

/**
 * HeyGen error class
 */
export class HeyGenError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "HeyGenError";
  }
}

/**
 * Make authenticated request to HeyGen API
 */
async function heygenRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!HEYGEN_API_KEY) {
    throw new HeyGenError(
      "HeyGen API key not configured",
      "MISSING_API_KEY"
    );
  }

  const url = `${HEYGEN_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": HEYGEN_API_KEY,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new HeyGenError(
        data.message || `HeyGen API error: ${response.status}`,
        data.code || "API_ERROR",
        response.status,
        data
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof HeyGenError) {
      throw error;
    }
    throw new HeyGenError(
      error instanceof Error ? error.message : "Unknown error",
      "NETWORK_ERROR",
      undefined,
      error
    );
  }
}

/**
 * Create a new video generation task
 */
export async function createVideoTask(
  request: VideoGenerationRequest
): Promise<HeyGenTaskResponse> {
  // Map our video types to HeyGen templates
  const templateConfig = getTemplateConfig(request.videoType);

  const payload = {
    video_title: `Proposal Video - ${request.proposalId}`,
    template_id: request.templateId || templateConfig.templateId,
    text: request.scriptText,
    avatar_id: request.avatarId || templateConfig.avatarId,
    voice_id: request.voiceId || templateConfig.voiceId,
    // Additional HeyGen options
    scale: 1,
    background_color: "#FFFFFF",
  };

  return heygenRequest<HeyGenTaskResponse>("/video/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Get video task status
 */
export async function getVideoStatus(
  videoId: string
): Promise<HeyGenTaskResponse> {
  return heygenRequest<HeyGenTaskResponse>(`/video/status/${videoId}`);
}

/**
 * List available avatars
 */
export async function listAvatars(): Promise<HeyGenAvatar[]> {
  const response = await heygenRequest<{
    data: Array<{
      avatar_id: string;
      name: string;
      avatar_style: string;
      preview_image: {
        large: string;
      };
    }>;
  }>("/avatars/list");

  return response.data.map((avatar) => ({
    id: avatar.avatar_id,
    name: avatar.name,
    preview_url: avatar.preview_image.large,
    style: mapAvatarStyle(avatar.avatar_style),
  }));
}

/**
 * List available voices
 */
export async function listVoices(): Promise<HeyGenVoice[]> {
  const response = await heygenRequest<{
    data: Array<{
      voice_id: string;
      name: string;
      language: string;
      gender: string;
      preview_url?: string;
    }>;
  }>("/voices/list");

  return response.data.map((voice) => ({
    id: voice.voice_id,
    name: voice.name,
    language: voice.language,
    gender: voice.gender as "male" | "female",
    preview_url: voice.preview_url,
  }));
}

/**
 * Template configuration mapping
 */
function getTemplateConfig(videoType: string): {
  templateId: string;
  avatarId: string;
  voiceId: string;
} {
  // Default template IDs (replace with actual HeyGen template IDs)
  const configs: Record<string, { templateId: string; avatarId: string; voiceId: string }> = {
    intro: {
      templateId: process.env.HEYGEN_TEMPLATE_INTRO || "template_intro_001",
      avatarId: process.env.HEYGEN_AVATAR_DEFAULT || "avatar_001",
      voiceId: process.env.HEYGEN_VOICE_DEFAULT || "voice_en_us_001",
    },
    section: {
      templateId: process.env.HEYGEN_TEMPLATE_SECTION || "template_section_001",
      avatarId: process.env.HEYGEN_AVATAR_DEFAULT || "avatar_001",
      voiceId: process.env.HEYGEN_VOICE_DEFAULT || "voice_en_us_001",
    },
    full_proposal: {
      templateId: process.env.HEYGEN_TEMPLATE_FULL || "template_full_001",
      avatarId: process.env.HEYGEN_AVATAR_DEFAULT || "avatar_001",
      voiceId: process.env.HEYGEN_VOICE_DEFAULT || "voice_en_us_001",
    },
    custom: {
      templateId: process.env.HEYGEN_TEMPLATE_CUSTOM || "template_custom_001",
      avatarId: process.env.HEYGEN_AVATAR_DEFAULT || "avatar_001",
      voiceId: process.env.HEYGEN_VOICE_DEFAULT || "voice_en_us_001",
    },
  };

  return configs[videoType] || configs.intro;
}

/**
 * Map HeyGen avatar style to our types
 */
function mapAvatarStyle(style: string): "formal" | "casual" | "business" {
  if (style.includes("business") || style.includes("formal")) {
    return "business";
  }
  if (style.includes("casual")) {
    return "casual";
  }
  return "formal";
}

/**
 * Estimate video duration from script text
 * Average speaking rate: ~150 words per minute
 */
export function estimateDuration(scriptText: string): number {
  const words = scriptText.trim().split(/\s+/).length;
  const minutes = words / 150;
  return Math.ceil(minutes * 60); // Round to nearest second
}

/**
 * Verify webhook signature from HeyGen
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // HeyGen uses HMAC-SHA256 for webhook signatures
  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return signature === `sha256=${expectedSignature}`;
}

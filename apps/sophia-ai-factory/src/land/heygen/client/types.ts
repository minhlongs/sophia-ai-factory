export const HEYGEN_API_URL = "https://api.heygen.com/v2";

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

export interface HeyGenVideoStatusResponse {
  data?: {
    status?: HeyGenVideoStatus['status'];
    video_url?: string;
    thumbnail_url?: string;
    error?: { message?: string };
  };
}

export interface HeyGenCreateVideoParams {
  avatarId: string;
  voiceId: string;
  script: string;
  title?: string;
}

export function buildCreateVideoPayload(params: HeyGenCreateVideoParams) {
  return {
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
}

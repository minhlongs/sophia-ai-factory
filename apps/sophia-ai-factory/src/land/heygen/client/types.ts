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

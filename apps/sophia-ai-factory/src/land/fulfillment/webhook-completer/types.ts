export interface HeyGenSuccessData {
  video_id: string;
  video_url: string;
  thumbnail_url?: string;
  duration?: number;
}

export interface HeyGenFailData {
  video_id: string;
  error?: string;
}

export interface UserRow {
  email?: string;
  locale?: string;
}

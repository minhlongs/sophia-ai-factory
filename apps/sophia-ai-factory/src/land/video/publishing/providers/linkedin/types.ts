export const LI_API = 'https://api.linkedin.com';
export const MAX_COMMENTARY_LEN = 3000;

export function isMockMode(): boolean {
  return !process.env.LINKEDIN_CLIENT_ID;
}

export interface RegisterUploadResponse {
  value: {
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
        uploadUrl: string;
        headers?: Record<string, string>;
      };
    };
    asset: string;
  };
}

export interface PostCreateResponse {
  id: string;
}

export interface VideoStatsResponse {
  elements?: Array<{
    totalShareStatistics?: {
      impressionCount?: number;
      likeCount?: number;
      commentCount?: number;
      shareCount?: number;
    };
  }>;
}

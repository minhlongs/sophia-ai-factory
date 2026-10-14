/**
 * Meta Instagram Reels Graph API 3-Step Container Lifecycle Adapter
 * @module tree/social/publisher/instagram-reels-adapter
 */

export interface InstagramContainerInput {
  readonly videoUrl: string;
  readonly caption: string;
  readonly shareToFeed?: boolean;
  readonly thumbOffsetMs?: number;
}

export function buildInstagramContainerInit(igUserId: string, input: InstagramContainerInput) {
  if (!input.videoUrl.startsWith('https://')) {
    throw new Error('videoUrl must be a secure public HTTPS URL (e.g. Cloudflare R2)');
  }
  return {
    endpoint: `https://graph.facebook.com/v21.0/${igUserId}/media`,
    body: {
      media_type: 'REELS' as const,
      video_url: input.videoUrl,
      caption: input.caption,
      share_to_feed: input.shareToFeed ?? true,
      ...(input.thumbOffsetMs !== undefined ? { thumb_offset: input.thumbOffsetMs } : {}),
    },
  };
}

export function buildInstagramStatusCheck(creationId: string) {
  return {
    endpoint: `https://graph.facebook.com/v21.0/${creationId}`,
    params: { fields: 'status_code,status' },
  };
}

export function parseInstagramContainerStatus(response: unknown): {
  statusCode: 'FINISHED' | 'IN_PROGRESS' | 'ERROR' | 'UNKNOWN';
  isReadyToPublish: boolean;
  isFailed: boolean;
} {
  if (typeof response !== 'object' || response === null) {
    return { statusCode: 'UNKNOWN', isReadyToPublish: false, isFailed: false };
  }
  const raw = String((response as Record<string, unknown>).status_code ?? '');
  if (raw === 'FINISHED') return { statusCode: 'FINISHED', isReadyToPublish: true, isFailed: false };
  if (raw === 'IN_PROGRESS') return { statusCode: 'IN_PROGRESS', isReadyToPublish: false, isFailed: false };
  if (raw === 'ERROR' || raw === 'EXPIRED') return { statusCode: 'ERROR', isReadyToPublish: false, isFailed: true };
  return { statusCode: 'UNKNOWN', isReadyToPublish: false, isFailed: false };
}

export function buildInstagramPublishRequest(igUserId: string, creationId: string) {
  return {
    endpoint: `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
    body: { creation_id: creationId },
  };
}

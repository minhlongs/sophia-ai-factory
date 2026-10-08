/**
 * Platform Publishing Protocol Adapters
 *
 * Implements chunk calculators and request payload builders for:
 * - YouTube Shorts (256 KiB aligned resumable uploads, #Shorts tagging)
 * - TikTok Content Posting API v2 (5MB-64MB chunking, status polling)
 * - Meta Instagram Reels Graph API (3-step container lifecycle)
 *
 * Layer: tree/social/publisher (Domain Logic)
 */

export type SocialPlatform = 'YOUTUBE_SHORTS' | 'TIKTOK_V2' | 'INSTAGRAM_REELS';

export interface ChunkByteRange {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly size: number;
  readonly contentRangeHeader: string;
}

export const YOUTUBE_CHUNK_UNIT_BYTES = 256 * 1024; // 262,144 bytes
export const YOUTUBE_DEFAULT_CHUNK_SIZE = 20 * YOUTUBE_CHUNK_UNIT_BYTES; // 5,242,880 bytes (5 MiB)
export const TIKTOK_MIN_CHUNK_BYTES = 5 * 1024 * 1024; // 5,242,880 bytes (5 MB)
export const TIKTOK_MAX_CHUNK_BYTES = 64 * 1024 * 1024; // 67,108,864 bytes (64 MB)

function sliceByteRanges(totalSize: number, chunkSize: number): ChunkByteRange[] {
  const chunks: ChunkByteRange[] = [];
  let start = 0;
  let index = 0;
  while (start < totalSize) {
    const end = Math.min(start + chunkSize - 1, totalSize - 1);
    chunks.push({
      index: index++,
      start,
      end,
      size: end - start + 1,
      contentRangeHeader: `bytes ${start}-${end}/${totalSize}`,
    });
    start = end + 1;
  }
  return chunks;
}

export function calculateYouTubeChunks(
  totalSizeBytes: number,
  chunkSize: number = YOUTUBE_DEFAULT_CHUNK_SIZE,
): ChunkByteRange[] {
  if (totalSizeBytes <= 0) throw new Error('totalSizeBytes must be greater than 0');
  if (chunkSize <= 0 || chunkSize % YOUTUBE_CHUNK_UNIT_BYTES !== 0) {
    throw new Error(`chunkSize must be a multiple of ${YOUTUBE_CHUNK_UNIT_BYTES} bytes`);
  }
  return sliceByteRanges(totalSizeBytes, chunkSize);
}

export interface YouTubeInitInput {
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly privacyStatus?: 'public' | 'unlisted' | 'private';
  readonly totalSizeBytes: number;
  readonly categoryId?: string;
}

export function buildYouTubeInitRequest(input: YouTubeInitInput) {
  const hasShorts = (input.title + (input.description ?? '')).toLowerCase().includes('#shorts');
  const description = hasShorts ? (input.description ?? '') : `${input.description ?? ''} #Shorts`.trim();
  const tags = Array.from(new Set([...(input.tags ?? []), 'Shorts', 'YouTubeShorts']));
  return {
    endpoint: 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/*',
      'X-Upload-Content-Length': String(input.totalSizeBytes),
    },
    body: {
      snippet: { title: input.title, description, tags, categoryId: input.categoryId ?? '22' },
      status: { privacyStatus: input.privacyStatus ?? 'public', selfDeclaredMadeForKids: false },
    },
  };
}

export function calculateTikTokChunks(
  totalSizeBytes: number,
  preferredChunkSize: number = TIKTOK_MIN_CHUNK_BYTES,
): { totalChunks: number; chunks: ChunkByteRange[]; chunkSize: number } {
  if (totalSizeBytes <= 0) throw new Error('totalSizeBytes must be greater than 0');
  const clampedSize = Math.max(TIKTOK_MIN_CHUNK_BYTES, Math.min(preferredChunkSize, TIKTOK_MAX_CHUNK_BYTES));
  const effectiveSize = totalSizeBytes <= TIKTOK_MIN_CHUNK_BYTES ? totalSizeBytes : clampedSize;
  const chunks = sliceByteRanges(totalSizeBytes, effectiveSize);
  return { totalChunks: chunks.length, chunks, chunkSize: effectiveSize };
}

export interface TikTokInitInput {
  readonly title: string;
  readonly totalSizeBytes: number;
  readonly chunkSizeBytes?: number;
  readonly postMode?: 'DIRECT_POST' | 'CREATOR_INBOX';
  readonly privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  readonly disableDuet?: boolean;
  readonly disableComment?: boolean;
  readonly disableStitch?: boolean;
}

export function buildTikTokInitPayload(input: TikTokInitInput) {
  const chunkInfo = calculateTikTokChunks(input.totalSizeBytes, input.chunkSizeBytes);
  return {
    endpoint: 'https://open.tiktokapis.com/v2/post/publish/video/init/',
    body: {
      post_mode: input.postMode ?? 'DIRECT_POST',
      post_info: {
        title: input.title,
        privacy_level: input.privacyLevel ?? 'PUBLIC_TO_EVERYONE',
        disable_duet: input.disableDuet ?? false,
        disable_comment: input.disableComment ?? false,
        disable_stitch: input.disableStitch ?? false,
      },
      source_info: {
        source: 'FILE_UPLOAD' as const,
        video_size: input.totalSizeBytes,
        chunk_size: chunkInfo.chunkSize,
        total_chunk_count: chunkInfo.totalChunks,
      },
    },
    chunks: chunkInfo.chunks,
  };
}

export function buildTikTokStatusPollingRequest(publishId: string) {
  return {
    endpoint: 'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
    body: { publish_id: publishId },
  };
}

export function parseTikTokPublishStatus(response: unknown): {
  status: 'SUCCESS_PUBLISH' | 'PROCESSING_UPLOAD' | 'PROCESSING_DOWNLOAD' | 'FAILED' | 'UNKNOWN';
  isTerminal: boolean;
  failReason?: string;
} {
  if (typeof response !== 'object' || response === null) return { status: 'UNKNOWN', isTerminal: false };
  const data = (response as Record<string, unknown>).data;
  if (typeof data !== 'object' || data === null) return { status: 'UNKNOWN', isTerminal: false };
  const raw = String((data as Record<string, unknown>).status ?? '');
  const failReason = typeof (data as Record<string, unknown>).fail_reason === 'string'
    ? ((data as Record<string, unknown>).fail_reason as string)
    : undefined;

  if (raw === 'SUCCESS_PUBLISH' || raw === 'PUBLISH_COMPLETE') return { status: 'SUCCESS_PUBLISH', isTerminal: true };
  if (raw === 'FAILED') return { status: 'FAILED', isTerminal: true, failReason };
  if (raw === 'PROCESSING_UPLOAD' || raw === 'PROCESSING_DOWNLOAD') return { status: raw, isTerminal: false };
  return { status: 'UNKNOWN', isTerminal: false };
}

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
  return { endpoint: `https://graph.facebook.com/v21.0/${creationId}`, params: { fields: 'status_code,status' } };
}

export function parseInstagramContainerStatus(response: unknown): {
  statusCode: 'FINISHED' | 'IN_PROGRESS' | 'ERROR' | 'UNKNOWN';
  isReadyToPublish: boolean;
  isFailed: boolean;
} {
  if (typeof response !== 'object' || response === null) return { statusCode: 'UNKNOWN', isReadyToPublish: false, isFailed: false };
  const raw = String((response as Record<string, unknown>).status_code ?? '');
  if (raw === 'FINISHED') return { statusCode: 'FINISHED', isReadyToPublish: true, isFailed: false };
  if (raw === 'IN_PROGRESS') return { statusCode: 'IN_PROGRESS', isReadyToPublish: false, isFailed: false };
  if (raw === 'ERROR' || raw === 'EXPIRED') return { statusCode: 'ERROR', isReadyToPublish: false, isFailed: true };
  return { statusCode: 'UNKNOWN', isReadyToPublish: false, isFailed: false };
}

export function buildInstagramPublishRequest(igUserId: string, creationId: string) {
  return { endpoint: `https://graph.facebook.com/v21.0/${igUserId}/media_publish`, body: { creation_id: creationId } };
}

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

import { sliceByteRanges, type ChunkByteRange } from './tiktok-v2-adapter';

export type SocialPlatform = 'YOUTUBE_SHORTS' | 'TIKTOK_V2' | 'INSTAGRAM_REELS';
export type { ChunkByteRange } from './tiktok-v2-adapter';

export const YOUTUBE_CHUNK_UNIT_BYTES = 256 * 1024; // 262,144 bytes
export const YOUTUBE_DEFAULT_CHUNK_SIZE = 20 * YOUTUBE_CHUNK_UNIT_BYTES; // 5,242,880 bytes (5 MiB)

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

export {
  TIKTOK_MIN_CHUNK_BYTES,
  TIKTOK_MAX_CHUNK_BYTES,
  calculateTikTokChunks,
  buildTikTokInitPayload,
  buildTikTokStatusPollingRequest,
  parseTikTokPublishStatus,
  type TikTokInitInput,
} from './tiktok-v2-adapter';

export {
  buildInstagramContainerInit,
  buildInstagramStatusCheck,
  parseInstagramContainerStatus,
  buildInstagramPublishRequest,
  type InstagramContainerInput,
} from './instagram-reels-adapter';

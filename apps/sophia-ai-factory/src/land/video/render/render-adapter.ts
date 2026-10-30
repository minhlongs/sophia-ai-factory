/**
 * Render adapter contract for OPC execution runs + HeyGen BYOK implementation.
 *
 * Security rules (non-negotiable for this path):
 * - The adapter only talks to the provider API with the workspace's own key.
 * - Media bytes are downloaded ONLY from provider allowlisted hosts, over
 *   https, with redirects rejected, a size cap, and a timeout. Arbitrary
 *   callback URLs are never fetched (SSRF).
 * - Downloaded bytes are verified (size, media magic bytes) and checksummed
 *   (SHA-256) by the caller before anything is recorded as verified media.
 *
 * Layer: land/video (provider integration)
 * @module land/video/render/render-adapter
 */

import { createHeyGenVideo, HEYGEN_API_URL } from '@/land/video/templates/heygen-helpers';
import { shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { logger } from '@/seed/utils/logger-utility';

export interface RenderSubmitInput {
  scriptBody: string;
  title: string;
  apiKey: string;
  avatarId?: string;
  voiceId?: string;
}

export type RenderJobStatus = 'processing' | 'completed' | 'failed';

export interface RenderStatusResult {
  status: RenderJobStatus;
  /** Provider-hosted media URL. Only present when completed. */
  mediaUrl?: string;
  durationSec?: number;
  errorMessage?: string;
}

export interface RenderAdapter {
  readonly provider: string;
  submit(input: RenderSubmitInput): Promise<{ providerJobId: string }>;
  /** Single-shot status read. Polling cadence is the caller's decision. */
  fetchStatus(providerJobId: string, apiKey: string): Promise<RenderStatusResult>;
  /** Guarded media download. Rejects non-provider hosts, redirects, oversize. */
  downloadBytes(mediaUrl: string): Promise<Uint8Array>;
}

/** Hosts the HeyGen API is known to serve finished renders from. */
const HEYGEN_MEDIA_HOST_SUFFIXES = ['heygen.com', 'heygen.ai'];

/** Largest render we will buffer into memory (256 MiB). */
export const MAX_RENDER_BYTES = 256 * 1024 * 1024;

const DOWNLOAD_TIMEOUT_MS = 120_000;

export function assertProviderMediaUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('RENDER_MEDIA_URL_INVALID: not a URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('RENDER_MEDIA_URL_INVALID: https required');
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = HEYGEN_MEDIA_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
  if (!allowed) {
    throw new Error(`RENDER_MEDIA_HOST_NOT_ALLOWLISTED: ${host}`);
  }
  return parsed;
}

/** True for MP4/MOV (ftyp), WebM/Matroska (EBML), or fragmented MP4. */
export function hasMediaMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  // EBML header (WebM/MKV): 0x1A 0x45 0xDF 0xA3
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return true;
  // ISO BMFF (MP4/MOV): 'ftyp' at offset 4
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return true;
  }
  return false;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function guardedDownload(mediaUrl: string): Promise<Uint8Array> {
  const parsed = assertProviderMediaUrl(mediaUrl);
  const res = await fetch(parsed.toString(), {
    // Never follow redirects: a redirect target is an unvetted host.
    redirect: 'error',
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`RENDER_DOWNLOAD_FAILED: HTTP ${res.status}`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.startsWith('video/') && !contentType.startsWith('application/octet-stream')) {
    throw new Error(`RENDER_DOWNLOAD_UNEXPECTED_CONTENT_TYPE: ${contentType.slice(0, 64)}`);
  }
  const contentLength = Number(res.headers.get('content-length') ?? '0');
  if (contentLength > MAX_RENDER_BYTES) {
    throw new Error(`RENDER_DOWNLOAD_OVERSIZE: ${contentLength} bytes`);
  }
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error('RENDER_DOWNLOAD_EMPTY');
  }
  if (buffer.byteLength > MAX_RENDER_BYTES) {
    throw new Error(`RENDER_DOWNLOAD_OVERSIZE: ${buffer.byteLength} bytes`);
  }
  const bytes = new Uint8Array(buffer);
  if (!hasMediaMagicBytes(bytes)) {
    throw new Error('RENDER_DOWNLOAD_NOT_MEDIA: magic bytes mismatch');
  }
  return bytes;
}

export const heyGenRenderAdapter: RenderAdapter = {
  provider: 'heygen',

  async submit(input: RenderSubmitInput): Promise<{ providerJobId: string }> {
    const created = await createHeyGenVideo({
      script: input.scriptBody,
      title: input.title,
      apiKey: input.apiKey,
      avatarId: input.avatarId,
      voiceId: input.voiceId,
      // No callback_url: completion is observed by polling the provider API
      // with our own key, so no inbound URL can inject a media location.
    });
    logger.info('[render-adapter] HeyGen job submitted', { providerJobId: created.videoId });
    return { providerJobId: created.videoId };
  },

  async fetchStatus(providerJobId: string, apiKey: string): Promise<RenderStatusResult> {
    if (!shouldAllowRequest('heygen')) {
      throw new Error('Circuit breaker open for HeyGen — too many failures');
    }
    const res = await fetch(`${HEYGEN_API_URL}/video/${providerJobId}`, {
      headers: { 'X-Api-Key': apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`HeyGen status ${res.status}`);
    }
    const json = (await res.json()) as {
      data?: {
        status?: string;
        video_url?: string;
        duration?: number;
        error?: { message?: string };
      };
    };
    const status = json.data?.status;
    if (status === 'completed' && json.data?.video_url) {
      return {
        status: 'completed',
        mediaUrl: json.data.video_url,
        durationSec: json.data?.duration,
      };
    }
    if (status === 'failed') {
      return {
        status: 'failed',
        errorMessage: json.data?.error?.message ?? 'HeyGen reported failure',
      };
    }
    return { status: 'processing' };
  },

  async downloadBytes(mediaUrl: string): Promise<Uint8Array> {
    return guardedDownload(mediaUrl);
  },
};

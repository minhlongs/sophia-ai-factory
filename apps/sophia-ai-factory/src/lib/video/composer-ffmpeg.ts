/**
 * FFmpeg Composer
 *
 * Merges audio + visual into final.mp4 via the MoviePy Fly service.
 *
 * Two paths:
 *   - Legacy `/compose`     — backward-compatible streaming mp4 only
 *   - Rich   `/compose-rich` — subtitle burn-in, watermark, audio loudnorm,
 *     thumbnail extraction, ffprobe metadata. Used when any of those features
 *     are requested.
 *
 * Outputs:
 *   tenants/{tid}/videos/{jid}/final.mp4
 *   tenants/{tid}/videos/{jid}/poster.jpg   (if generateThumbnail)
 *
 * @module lib/video/composer-ffmpeg
 */

import { getVideoBucket, tenantScopedKey } from '@/lib/video/r2-binding';
import { recordCost } from '@/lib/video/cost-ledger';
import { logger } from '@/seed/utils/logger-utility';
import { withBreaker, BreakerOpenError } from '@/lib/video/circuit-breaker';
import { loadBrandKitOverrides } from '@/lib/video/brand-kit-composer';

export interface SubtitleStyle {
  fontSize?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  position?: 'top' | 'center' | 'bottom';
  font?: string;
}

export interface WatermarkConfig {
  text?: string;
  logoUrl?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  opacity?: number;
}

export interface VideoMetadata {
  durationSeconds: number;
  sizeBytes: number;
  width: number;
  height: number;
  codecName: string;
}

export interface ComposeInput {
  jobId: string;
  tenantId: string;
  audioR2Key: string;
  visualR2Key: string;
  subtitleSrt?: string;
  /** When provided alongside subtitleSrt, captions are burned-in (TikTok/IG ready). */
  subtitleStyle?: SubtitleStyle;
  /** Agency-branding overlay. Merged with text fallback when logo fetch fails. */
  watermark?: WatermarkConfig;
  /** EBU R128 normalize voice track to -14 LUFS for consistent loudness. */
  normalizeAudio?: boolean;
  /** When true, server extracts a poster frame and Worker uploads it to R2. */
  generateThumbnail?: boolean;
  /** Brand kit intro video clip key in R2. */
  introR2Key?: string | null;
  /** Brand kit outro video clip key in R2. */
  outroR2Key?: string | null;
}

export interface ComposeResult {
  finalR2Key: string;
  costUsd: number;
  thumbnailR2Key?: string;
  metadata?: VideoMetadata;
  /** True when fly call short-circuited because the breaker was OPEN. */
  degraded?: boolean;
}

const STUB_MP4_B64 = 'AAAAHGZ0eXBpc29tAAACAGlzb21pc28yYXZjMQAAAAhmcmVlAAAAG21kYXQ=';
const BREAKER_NAME = 'moviepy-fly';
const FINAL_VIDEO_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const POSTER_CACHE_CONTROL = 'public, max-age=86400';

/** Decide which fly endpoint to call based on the requested features. */
function needsRichCompose(input: ComposeInput): boolean {
  return Boolean(
    input.watermark
      || input.normalizeAudio
      || (input.subtitleSrt && input.subtitleStyle)
      || input.generateThumbnail
      || input.introR2Key
      || input.outroR2Key,
  );
}

function metadataFromHeader(value: string | null): VideoMetadata | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Partial<{
      duration_seconds: number;
      size_bytes: number;
      width: number;
      height: number;
      codec_name: string;
    }>;
    return {
      durationSeconds: parsed.duration_seconds ?? 0,
      sizeBytes: parsed.size_bytes ?? 0,
      width: parsed.width ?? 0,
      height: parsed.height ?? 0,
      codecName: parsed.codec_name ?? '',
    };
  } catch {
    return undefined;
  }
}

function thumbnailFromHeader(value: string | null): ArrayBuffer | undefined {
  if (!value) return undefined;
  try {
    const bin = atob(value);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  } catch {
    return undefined;
  }
}

/**
 * Compose audio + visual into final MP4. Optionally adds subtitles, watermark,
 * audio normalization, and thumbnail extraction. Rate-protected by a circuit
 * breaker around the upstream MoviePy fly call.
 */
export async function composeFinalVideo(input: ComposeInput): Promise<ComposeResult> {
  const { jobId, tenantId, audioR2Key, visualR2Key } = input;
  const finalR2Key = tenantScopedKey(tenantId, jobId, 'final.mp4');
  const flyUrl = process.env.MOVIEPY_FLY_URL;
  const costUsd = needsRichCompose(input) ? 0.07 : 0.05;

  let videoBytes: ArrayBuffer;
  let thumbnailBytes: ArrayBuffer | undefined;
  let metadata: VideoMetadata | undefined;
  let degraded = false;

  if (!flyUrl) {
    logger.warn('[Composer] MOVIEPY_FLY_URL not set — using stub final mp4', { jobId });
    videoBytes = Buffer.from(STUB_MP4_B64, 'base64').buffer;
  } else {
    try {
      const res = await withBreaker(BREAKER_NAME, () => callFly(flyUrl, input));
      videoBytes = await res.arrayBuffer();
      metadata = metadataFromHeader(res.headers.get('X-Sophia-Metadata'));
      thumbnailBytes = input.generateThumbnail
        ? thumbnailFromHeader(res.headers.get('X-Sophia-Thumbnail-B64'))
        : undefined;
    } catch (err) {
      if (err instanceof BreakerOpenError) {
        // Upstream is degraded — use stub so the pipeline keeps moving.
        // Caller sees `degraded: true` and can mark the job for later re-render.
        logger.warn('[Composer] Breaker OPEN — falling back to stub mp4', { jobId });
        videoBytes = Buffer.from(STUB_MP4_B64, 'base64').buffer;
        degraded = true;
      } else {
        throw err;
      }
    }
  }

  const ref = await getVideoBucket();
  if (ref) {
    await ref.bucket.put(finalR2Key, videoBytes, {
      httpMetadata: { contentType: 'video/mp4', cacheControl: FINAL_VIDEO_CACHE_CONTROL },
    });
    logger.info('[Composer] Final video uploaded to R2', { jobId, finalR2Key });
  } else {
    logger.warn('[Composer] VIDEO_BUCKET unavailable — R2 write skipped', { jobId });
  }

  let thumbnailR2Key: string | undefined;
  if (thumbnailBytes && ref) {
    thumbnailR2Key = tenantScopedKey(tenantId, jobId, 'poster.jpg');
    await ref.bucket.put(thumbnailR2Key, thumbnailBytes, {
      httpMetadata: { contentType: 'image/jpeg', cacheControl: POSTER_CACHE_CONTROL },
    });
    logger.info('[Composer] Thumbnail uploaded to R2', { jobId, thumbnailR2Key });
  }

  await recordCost({ jobId, stage: 'compose', provider: 'moviepy-ffmpeg', units: 1, costUsd });

  return { finalR2Key, costUsd, thumbnailR2Key, metadata, degraded };
}

/** Issue the actual HTTP call to MoviePy fly. Wrapped in `withBreaker`. */
async function callFly(flyUrl: string, input: ComposeInput): Promise<Response> {
  const useRich = needsRichCompose(input);
  const path = useRich ? '/compose-rich' : '/compose';

  const body = useRich
    ? {
        audio_r2_key: input.audioR2Key,
        visual_r2_key: input.visualR2Key,
        subtitle_srt: input.subtitleSrt ?? '',
        subtitle_style: input.subtitleStyle
          ? {
              font_size: input.subtitleStyle.fontSize ?? 48,
              color: input.subtitleStyle.color ?? 'white',
              stroke_color: input.subtitleStyle.strokeColor ?? 'black',
              stroke_width: input.subtitleStyle.strokeWidth ?? 3,
              position: input.subtitleStyle.position ?? 'bottom',
              font: input.subtitleStyle.font ?? 'Noto-Sans-Bold',
            }
          : null,
        watermark: input.watermark
          ? {
              text: input.watermark.text ?? null,
              logo_url: input.watermark.logoUrl ?? null,
              position: input.watermark.position ?? 'bottom-right',
              opacity: input.watermark.opacity ?? 0.85,
            }
          : null,
        loudnorm: input.normalizeAudio === true,
        output_thumbnail: input.generateThumbnail !== false,
        output_format: 'mp4',
        intro_r2_key: input.introR2Key ?? null,
        outro_r2_key: input.outroR2Key ?? null,
      }
    : {
        audio_r2_key: input.audioR2Key,
        visual_r2_key: input.visualR2Key,
        subtitle_srt: input.subtitleSrt ?? '',
        output_format: 'mp4',
      };

  const res = await fetch(`${flyUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`[Composer] MoviePy ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res;
}

/**
 * Standard TikTok/IG REELS subtitle preset — white text, black stroke,
 * bottom-anchored. Useful default for short-form content.
 */
export const TIKTOK_SUBTITLE_STYLE: SubtitleStyle = {
  fontSize: 56,
  color: 'white',
  strokeColor: 'black',
  strokeWidth: 4,
  position: 'bottom',
  font: 'Noto-Sans-Bold',
};

/**
 * Enrich ComposeInput with the user's brand kit (watermark, subtitle colors).
 * Explicit values in input take precedence over brand kit defaults.
 */
export async function applyBrandKit(
  userId: string,
  input: ComposeInput,
): Promise<ComposeInput> {
  try {
    const overrides = await loadBrandKitOverrides(userId);
    return {
      ...input,
      watermark: input.watermark ?? overrides.watermark,
      subtitleStyle: input.subtitleStyle ?? overrides.subtitleStyle,
      introR2Key: input.introR2Key ?? overrides.introR2Key,
      outroR2Key: input.outroR2Key ?? overrides.outroR2Key,
    };
  } catch (err) {
    logger.warn('[Composer] Brand kit load failed — proceeding without', {
      userId,
      error: String(err),
    });
    return input;
  }
}

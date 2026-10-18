import { logger } from '@/seed/utils/logger-utility';
import { loadBrandKitOverrides } from '@/land/video/assembly/brand-kit-composer';
import type { ComposeInput, SubtitleStyle, VideoMetadata } from './types';

export const STUB_MP4_B64 = 'AAAAHGZ0eXBpc29tAAACAGlzb21pc28yYXZjMQAAAAhmcmVlAAAAG21kYXQ=';
export const BREAKER_NAME = 'moviepy-fly';
export const FINAL_VIDEO_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const POSTER_CACHE_CONTROL = 'public, max-age=86400';

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

/** Decide which fly endpoint to call based on the requested features. */
export function needsRichCompose(input: ComposeInput): boolean {
  return Boolean(
    input.watermark
      || input.normalizeAudio
      || (input.subtitleSrt && input.subtitleStyle)
      || input.generateThumbnail
      || input.introR2Key
      || input.outroR2Key
      || input.startSec !== undefined
      || input.endSec !== undefined
      || input.cropVertical,
  );
}

export function metadataFromHeader(value: string | null): VideoMetadata | undefined {
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

export function thumbnailFromHeader(value: string | null): ArrayBuffer | undefined {
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

export function buildFlyComposePayload(input: ComposeInput): { path: string; body: Record<string, unknown> } {
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
        start_sec: input.startSec ?? null,
        end_sec: input.endSec ?? null,
        crop_vertical: input.cropVertical === true,
      }
    : {
        audio_r2_key: input.audioR2Key,
        visual_r2_key: input.visualR2Key,
        subtitle_srt: input.subtitleSrt ?? '',
        output_format: 'mp4',
      };
  return { path, body };
}

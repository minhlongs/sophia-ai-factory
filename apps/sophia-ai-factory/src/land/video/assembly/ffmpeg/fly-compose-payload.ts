/**
 * Fly.io MoviePy/FFmpeg compose payload builder.
 * @module land/video/assembly/ffmpeg/fly-compose-payload
 */

import type { ComposeInput } from './types';

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

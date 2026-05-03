/**
 * Handler: subtitle:generate
 *
 * Generates SRT subtitles from audio using the existing subtitle-generator lib.
 * LIVE — calls Cloudflare Workers AI Whisper binding.
 */

import { generateSubtitles } from '@/lib/video/subtitle-generator';
import type { MissionHandlerResult, MissionContext } from './types';

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const audioR2Key = (ctx.params?.audio_r2_key as string) ?? '';

  if (!audioR2Key) {
    return { ok: false, error: 'params.audio_r2_key is required (R2 object key of audio file)' };
  }

  const result = await generateSubtitles({
    audioR2Key,
    jobId: ctx.missionId,
  });

  return {
    ok: true,
    data: {
      srt: result.srt,
      audio_r2_key: audioR2Key,
      format: 'srt',
    },
  };
}

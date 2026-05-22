/**
 * Handler: caption:generate
 *
 * Submits an audio/video URL to AssemblyAI for transcription and caption generation.
 * Uses the user's own AssemblyAI API key (BYOK). Returns transcript_id and initial status.
 *
 * The job is async — caller should poll via caption:status or a background job
 * using the returned transcript_id.
 *
 * LIVE — requires AssemblyAI API key in user_provider_credentials.
 */

import { AssemblyAIClient } from '@/lib/video/assemblyai-client';
import { getAssemblyAIKey } from '@/tree/credentials/get-provider-key';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionHandlerResult, MissionContext } from './types';

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { userId, params } = ctx;

  const videoUrl = params?.video_url as string | undefined;
  if (!videoUrl) {
    return {
      ok: false,
      error: 'Missing required param: video_url',
    };
  }

  const language = (params?.language as string | undefined) ?? 'auto';

  const keyResult = await getAssemblyAIKey({ userId, fallbackToPlatform: false });
  if (!keyResult) {
    return {
      ok: false,
      error: 'AssemblyAI API key not configured. Add it in Settings > Integrations.',
    };
  }

  const client = new AssemblyAIClient({ apiKey: keyResult.key });

  try {
    const result = await client.transcribe({
      audioUrl: videoUrl,
      languageCode: language,
      punctuate: true,
    });

    logger.info('[caption:generate] Transcription job submitted', {
      userId,
      transcriptId: result.transcriptId,
      status: result.status,
    });

    return {
      ok: true,
      data: {
        transcript_id: result.transcriptId,
        status: result.status,
      },
    };
  } catch (err) {
    logger.error(
      '[caption:generate] AssemblyAI error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'AssemblyAI transcription submission failed',
    };
  }
}

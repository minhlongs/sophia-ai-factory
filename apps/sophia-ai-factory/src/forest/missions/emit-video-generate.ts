/**
 * Forest helper: emit 'video/generate.requested' Inngest event.
 *
 * Thin wrapper around inngest.send so callers don't need to import
 * the typed client directly. Keeps the event payload shape in one place.
 */

import { inngest } from '@/forest/inngest/client';
import type { VideoGenerateRequestedEvent } from '@/lib/video/types';

export interface EmitVideoGenerateInput {
  missionId: string;
  tenantId: string;
  userId: string;
  prompt: string;
  voiceoverText?: string;
  language?: 'en' | 'vi';
}

/**
 * Send the video/generate.requested event to Inngest.
 * The videoGenerate function (registered in functions/index.ts:36)
 * will pick this up and execute the full TTS → Wan → mux pipeline.
 */
export async function emitVideoGenerate(input: EmitVideoGenerateInput): Promise<void> {
  const payload: VideoGenerateRequestedEvent = {
    missionId: input.missionId,
    tenantId: input.tenantId,
    userId: input.userId,
    prompt: input.prompt,
    voiceoverText: input.voiceoverText ?? input.prompt,
    language: input.language ?? 'en',
  };

  await inngest.send({
    name: 'video/generate.requested',
    data: payload,
  });
}

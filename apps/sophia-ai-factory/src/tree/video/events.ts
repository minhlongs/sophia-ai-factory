/**
 * Video event emitters — business-domain event publishing utilities
 *
 * These functions emit events for the video pipeline. They are placed in tree
 * (domain reusable) so that both land and forest can use them without
 * cross-layer dependency violations.
 */

import { inngest } from '@/tree/inngest/client';
import type { VideoGenerateRequestedEvent } from '@/seed/types/video-events';

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

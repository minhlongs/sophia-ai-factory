import { z } from 'zod';
import { inngest } from '@/seed/inngest/client';
import { releaseVideoSlot } from '@/tree/quota/video-quota';
import { logger } from '@/seed/utils/logger-utility';

export const GenerateVideoBody = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  voiceoverText: z.string().optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional(),
  durationSec: z.number().int().positive().optional(),
  language: z.enum(['en', 'vi']).optional(),
});

export type GenerateVideoBodyData = z.infer<typeof GenerateVideoBody>;

export interface MissionRow {
  id: string;
  user_id: string;
  status: string;
}

export const BLOCKED_STATUSES = new Set(['failed', 'cancelled']);

export async function dispatchGenerateVideoEvent(
  missionId: string,
  userId: string,
  data: GenerateVideoBodyData,
): Promise<string | null> {
  try {
    const { ids } = await inngest.send({
      name: 'video/generate.requested',
      data: {
        missionId,
        userId,
        prompt: data.prompt,
        voiceoverText: data.voiceoverText,
        aspectRatio: data.aspectRatio,
        durationSec: data.durationSec,
        language: data.language,
      },
    });
    return ids[0] ?? null;
  } catch (err) {
    // Release the slot we just reserved — the job never queued.
    await releaseVideoSlot(userId).catch((releaseErr) => {
      logger.warn('Failed to release video slot after queuing error', {
        error: String(releaseErr),
        context: 'POST',
        missionId,
        userId,
      });
    });
    throw err;
  }
}

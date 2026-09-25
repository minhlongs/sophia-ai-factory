'use server';

/**
 * Server Action: Request APAC Multi-Language Video Dubbing
 *
 * Layer: land (user-facing mutation / Server Action)
 *
 * @module land/video/dubbing/actions/request-dubbing-action
 */

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { ApacLocaleSchema, type ApacLocale } from '@/seed/types/dubbing';
import { createDubbingJob } from '../dubbing-service';

export interface RequestDubbingPayload {
  videoId: string;
  targetLocales: ApacLocale[];
  sourceLocale?: ApacLocale;
  sourceAudioR2Key?: string;
  sourceVideoUrl?: string;
  voiceIds?: Partial<Record<ApacLocale, string>>;
  generateSubtitles?: boolean;
}

export interface RequestDubbingResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

const RequestDubbingSchema = z.object({
  videoId: z.string().min(1, 'videoId is required'),
  targetLocales: z.array(ApacLocaleSchema).min(1, 'At least one target APAC locale is required'),
  sourceLocale: ApacLocaleSchema.optional().default('vi'),
  sourceAudioR2Key: z.string().optional(),
  sourceVideoUrl: z.string().url().optional(),
  voiceIds: z.record(ApacLocaleSchema, z.string()).optional(),
  generateSubtitles: z.boolean().optional().default(true),
});

/**
 * Server Action called by UI to request dubbing into target APAC locales.
 */
export async function requestDubbingAction(
  payload: RequestDubbingPayload,
): Promise<RequestDubbingResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHENTICATED' };
    }

    const validated = RequestDubbingSchema.safeParse(payload);
    if (!validated.success) {
      return {
        success: false,
        error: `INVALID_INPUT: ${validated.error.issues.map((i) => i.message).join(', ')}`,
      };
    }

    const { videoId, targetLocales, sourceLocale, sourceAudioR2Key, sourceVideoUrl, voiceIds, generateSubtitles } =
      validated.data;

    const { jobId } = await createDubbingJob({
      videoId,
      targetLocales,
      sourceLocale,
      sourceAudioR2Key,
      sourceVideoUrl,
      voiceIds,
      generateSubtitles,
      userId: user.id,
      tenantId: user.id,
    });

    logger.info('[requestDubbingAction] Dubbing job registered', {
      jobId,
      videoId,
      userId: user.id,
      targetLocales,
    });

    return {
      success: true,
      jobId,
    };
  } catch (err) {
    logger.error('[requestDubbingAction] Unexpected error', { error: String(err) });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

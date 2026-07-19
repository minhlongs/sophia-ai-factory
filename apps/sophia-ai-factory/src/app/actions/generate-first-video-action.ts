'use server';

/**
 * Server Action: generateFirstVideoAction
 *
 * One-click "Generate My First Video" for the QuickStart onboarding flow.
 * Submits a short welcome script to HeyGen via the user's BYOK key.
 *
 * Security: userId from auth session — never trusts URL/form input.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { submitByokVideo } from '@/land/video/generation/render-byok-video';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export interface GenerateFirstVideoResult {
  success: boolean;
  videoId?: string;
  status?: string;
  error?: string;
}

const DEFAULT_SCRIPT =
  'Welcome to Sophia AI Factory! I am your AI video assistant, ready to help you create amazing content. Let us get started on your first video today.';

const DEFAULT_TITLE = 'My First Sophia Video';

export async function generateFirstVideoAction(): Promise<GenerateFirstVideoResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'unauthorized' };
    }

    const result = await submitByokVideo({
      userId: user.id,
      script: DEFAULT_SCRIPT,
      title: DEFAULT_TITLE,
    });

    logger.info('[GenerateFirstVideo] Success', {
      userId: user.id,
      videoId: result.videoId,
      heygenJobId: result.heygenJobId,
    });

    return {
      success: true,
      videoId: result.videoId,
      status: result.status,
    };
  } catch (err) {
    const error = toError(err);
    logger.error('[GenerateFirstVideo] Failed', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

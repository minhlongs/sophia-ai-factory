'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { generateVideo } from '@/land/video/publishing/video-generation.service';

export type VideoGenerateResult =
  | { success: true; missionId: string }
  | { success: false; error: string; code?: string };

/**
 * Server Action: generateVideoAction
 *
 * Validates input and delegates to video-service.generateVideo().
 * Returns missionId for backward compatibility with existing UI.
 */

export async function generateVideoAction(
  input: unknown,
): Promise<VideoGenerateResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHENTICATED' };
  }

  // Validate input shape
  if (typeof input !== 'object' || input === null) {
    return { success: false, error: 'Invalid input format', code: 'VALIDATION_ERROR' };
  }

  const { prompt, language, style } = input as Record<string, unknown>;

  if (typeof prompt !== 'string' || prompt.length < 10 || prompt.length > 500) {
    return {
      success: false,
      error: 'Prompt must be 10-500 characters',
      code: 'VALIDATION_ERROR',
    };
  }

  const result = await generateVideo(
    {
      prompt,
      style: style as 'cinematic' | 'casual' | 'educational' | undefined,
      language: language as 'en' | 'vi' | undefined,
    },
    user.id,
  );

  if (result.success) {
    return { success: true, missionId: result.jobId };
  } else {
    return {
      success: false,
      error: result.error,
      code: result.code,
    };
  }
}

import { Tier } from "@/seed/types";
import type { ScriptOutput } from "./script-prompt-builders";

interface GenerateVideoInput {
  script: ScriptOutput;
  tier: Tier;
  userId?: string;
}

interface VideoOutput {
  video_url: string;
  thumbnail_url: string;
}

interface VideoService {
  createVideo(params: { avatarId: string; voiceId: string; script: string; title: string }): Promise<string>;
  getVideoStatus(jobId: string): Promise<{ status: string; video_url?: string; thumbnail_url?: string; error?: string }>;
}

/**
 * Starts a video generation job.
 * Returns a job ID (for HeyGen) or a mock ID.
 *
 * @param getVideoService - Factory for creating VideoService instances (injected to avoid layer violation)
 */
export async function startVideoGeneration(
  input: GenerateVideoInput,
  getVideoService?: (userId?: string) => Promise<VideoService>,
): Promise<string> {
  const { script, userId } = input;

  if (!getVideoService) {
    throw new Error('Video generation requires a getVideoService factory — import from @/land/services/factory');
  }

  const videoService = await getVideoService(userId);

  const fullNarration = script.scenes.map(s => s.narration).join(' ');

  const avatarId = 'default_avatar_001';
  const voiceId = 'en-US-1';

  return await videoService.createVideo({
    avatarId,
    voiceId,
    script: fullNarration,
    title: `Sophia Campaign - ${new Date().toISOString()}`
  });
}

/**
 * Checks the status of a video generation job.
 */
export async function checkVideoGenerationStatus(
  jobId: string,
  _tier: Tier,
  userId?: string,
  getVideoService?: (userId?: string) => Promise<VideoService>,
): Promise<{ status: 'processing' | 'completed' | 'failed'; output?: VideoOutput; error?: string }> {
  if (!getVideoService) {
    return { status: 'failed', error: 'Video service not available — import from @/land/services/factory' };
  }

  const videoService = await getVideoService(userId);

  try {
    const status = await videoService.getVideoStatus(jobId);

    if (status.status === 'completed') {
      if (!status.video_url) return { status: 'failed', error: 'Completed but no URL' };
      return {
        status: 'completed',
        output: {
          video_url: status.video_url,
          thumbnail_url: status.thumbnail_url || status.video_url.replace('.mp4', '.jpg')
        }
      };
    }

    if (status.status === 'failed') {
      return { status: 'failed', error: status.error || 'Video generation failed' };
    }

    return { status: 'processing' };
  } catch {
    return { status: 'processing' };
  }
}

/**
 * Legacy wrapper for backward compatibility if needed.
 */
export async function generateVideo(
  input: GenerateVideoInput,
  getVideoService?: (userId?: string) => Promise<VideoService>,
): Promise<VideoOutput> {
  const jobId = await startVideoGeneration(input, getVideoService);

  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const result = await checkVideoGenerationStatus(jobId, input.tier, input.userId, getVideoService);

    if (result.status === 'completed' && result.output) {
      return result.output;
    }

    if (result.status === 'failed') {
      throw new Error(result.error || 'Video generation failed');
    }
  }

  throw new Error('Video generation timed out');
}

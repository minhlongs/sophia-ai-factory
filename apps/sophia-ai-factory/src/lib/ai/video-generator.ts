import { Tier } from "@/seed/types";
import { ServiceFactory } from "@/lib/services/factory";
import { VideoStatus } from "@/lib/services/types";

interface GenerateVideoInput {
  script: unknown; // typed as ScriptOutput in practice
  tier: Tier;
  userId?: string;
}

interface VideoOutput {
  video_url: string;
  thumbnail_url: string;
}

/**
 * Starts a video generation job.
 * Returns a job ID (for HeyGen) or a mock ID.
 */
export async function startVideoGeneration(input: GenerateVideoInput): Promise<string> {
  const { script: rawScript, userId } = input;
  const videoService = await ServiceFactory.getVideoService(userId);

  // Extract narration from script
  const script = rawScript as { scenes: Array<{ narration: string }> };
  const fullNarration = script.scenes.map(s => s.narration).join(' ');

  const avatarId = 'default_avatar_001'; // Replace with a valid default ID
  const voiceId = 'en-US-1'; // Replace with a valid default Voice ID


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
 
export async function checkVideoGenerationStatus(jobId: string, _tier: Tier, userId?: string): Promise<{ status: 'processing' | 'completed' | 'failed'; output?: VideoOutput; error?: string }> {
  const videoService = await ServiceFactory.getVideoService(userId);

  try {
    const status: VideoStatus = await videoService.getVideoStatus(jobId);

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
    // Return processing on transient errors so we retry
    return { status: 'processing' };
  }
}

/**
 * Legacy wrapper for backward compatibility if needed,
 * but Inngest function should use start/check pattern.
 */
export async function generateVideo(input: GenerateVideoInput): Promise<VideoOutput> {
  const jobId = await startVideoGeneration(input);

  // Poll until done
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const result = await checkVideoGenerationStatus(jobId, input.tier);

    if (result.status === 'completed' && result.output) {
      return result.output;
    }

    if (result.status === 'failed') {
      throw new Error(result.error || 'Video generation failed');
    }
  }

  throw new Error('Video generation timed out');
}



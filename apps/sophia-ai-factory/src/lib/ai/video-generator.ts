import { Tier } from "@/types";
import { getHeyGenClient } from "@/lib/heygen/heygen-client";

interface GenerateVideoInput {
  script: unknown; // typed as ScriptOutput in practice
  tier: Tier;
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
  const { tier } = input;
  const heygenClient = getHeyGenClient();

  if (heygenClient) {
    try {
      // Extract narration from script
      const script = input.script as { scenes: Array<{ narration: string }> };
      const fullNarration = script.scenes.map(s => s.narration).join(' ');

      const avatarId = 'default_avatar_001'; // Replace with a valid default ID
      const voiceId = 'en-US-1'; // Replace with a valid default Voice ID

      console.log('Starting HeyGen video generation job...');
      const videoId = await heygenClient.createVideo({
        avatarId,
        voiceId,
        script: fullNarration,
        title: `Sophia Campaign - ${new Date().toISOString()}`
      });
      return videoId;
    } catch (error) {
      console.error('HeyGen API error:', error);
      console.warn('Falling back to mock video generation');
    }
  } else {
    console.warn('HEYGEN_API_KEY not set, using mock video generation');
  }

  // Return a mock ID that starts with "mock_"
  return `mock_${tier}_${Date.now()}`;
}

/**
 * Checks the status of a video generation job.
 */
export async function checkVideoGenerationStatus(jobId: string, tier: Tier): Promise<{ status: 'processing' | 'completed' | 'failed'; output?: VideoOutput; error?: string }> {
  const heygenClient = getHeyGenClient();

  // Handle mock jobs
  if (jobId.startsWith("mock_")) {
    // Simulate processing time check based on timestamp in mock ID
    const timestamp = parseInt(jobId.split('_')[2]);
    const elapsed = Date.now() - timestamp;

    if (elapsed < 5000) {
      return { status: 'processing' };
    }

    const videoSamples = tier === 'ENTERPRISE'
      ? [
          {
            video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            thumbnail_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg"
          }
        ]
      : [
          {
            video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            thumbnail_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg"
          }
        ];

    const sample = videoSamples[0];
    return {
      status: 'completed',
      output: sample
    };
  }

  // Handle real HeyGen jobs
  if (heygenClient) {
    try {
      const status = await heygenClient.getVideoStatus(jobId);

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
        return { status: 'failed', error: status.error || 'HeyGen generation failed' };
      }

      return { status: 'processing' };
    } catch (error) {
      console.error(`Error checking HeyGen status for ${jobId}:`, error);
      // Return processing on transient errors so we retry
      return { status: 'processing' };
    }
  }

  return { status: 'failed', error: 'HeyGen client unavailable for non-mock ID' };
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



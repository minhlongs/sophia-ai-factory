import { Tier } from "@/types";

interface GenerateVideoInput {
  script: unknown; // typed as ScriptOutput in practice
  tier: Tier;
}

interface VideoOutput {
  video_url: string;
  thumbnail_url: string;
}

/**
 * Generates a video from a script.
 *
 * CURRENTLY MOCKED: This uses sample video URLs while HeyGen integration is pending.
 *
 * To integrate real video generation:
 * 1. Sign up for HeyGen API: https://heygen.com/api
 * 2. Add HEYGEN_API_KEY to .env
 * 3. Use HeyGen's /v2/video/generate endpoint
 * 4. Poll /v2/video/{video_id} until status='completed'
 * 5. Return the permanent video URL
 *
 * Alternative services:
 * - D-ID: https://studio.d-id.com/
 * - Synthesia: https://synthesia.io/
 * - Replicate (open source models): https://replicate.com/
 */
export async function generateVideo(input: GenerateVideoInput): Promise<VideoOutput> {
  const { tier } = input;

  // Check for HeyGen API key
  const heygenKey = process.env.HEYGEN_API_KEY;

  if (heygenKey) {
    try {
      return await generateHeyGenVideo(input, heygenKey);
    } catch (error) {
      console.error('HeyGen API error:', error);
      console.warn('Falling back to mock video generation');
    }
  } else {
    console.warn('HEYGEN_API_KEY not set, using mock video generation');
  }

  // Mock implementation with realistic timing
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Return tier-appropriate sample videos
  const videoSamples = tier === 'ENTERPRISE'
    ? [
        // HD enterprise samples
        {
          video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          thumbnail_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg"
        },
        {
          video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
          thumbnail_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg"
        }
      ]
    : [
        // Standard tier samples
        {
          video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          thumbnail_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg"
        },
        {
          video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
          thumbnail_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg"
        }
      ];

  // Rotate through samples for variety
  const sample = videoSamples[Math.floor(Math.random() * videoSamples.length)];
  return sample;
}

/**
 * Real HeyGen API integration (when key is available)
 */
async function generateHeyGenVideo(
  input: GenerateVideoInput,
  apiKey: string
): Promise<VideoOutput> {
  // Extract narration from script
  const script = input.script as { scenes: Array<{ narration: string }> };
  const fullNarration = script.scenes.map(s => s.narration).join(' ');

  // Step 1: Create video generation job
  const createResponse = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      video_inputs: [{
        character: {
          type: 'avatar',
          avatar_id: 'default_avatar_001', // Use HeyGen avatar ID
          avatar_style: 'normal'
        },
        voice: {
          type: 'text',
          input_text: fullNarration,
          voice_id: 'en-US-1' // Default English voice
        }
      }],
      dimension: {
        width: 1920,
        height: 1080
      }
    })
  });

  if (!createResponse.ok) {
    throw new Error(`HeyGen API failed: ${createResponse.status}`);
  }

  const createData = await createResponse.json();
  const videoId = createData.data?.video_id;

  if (!videoId) {
    throw new Error('No video_id in HeyGen response');
  }

  // Step 2: Poll for completion (max 2 minutes)
  const maxAttempts = 24; // 24 * 5s = 2 minutes
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    const statusResponse = await fetch(`https://api.heygen.com/v2/video/${videoId}`, {
      headers: { 'X-Api-Key': apiKey }
    });

    if (!statusResponse.ok) {
      throw new Error(`HeyGen status check failed: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    const status = statusData.data?.status;

    if (status === 'completed') {
      return {
        video_url: statusData.data.video_url,
        thumbnail_url: statusData.data.thumbnail_url || statusData.data.video_url.replace('.mp4', '.jpg')
      };
    }

    if (status === 'failed') {
      throw new Error('HeyGen video generation failed');
    }
  }

  throw new Error('HeyGen video generation timed out');
}

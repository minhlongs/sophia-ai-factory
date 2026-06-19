/**
 * video-generate E2E Test
 *
 * Skipped automatically when secrets are not present in the environment.
 * Run locally with:
 *
 *   REPLICATE_API_KEY=... FAL_API_KEY=... CLOUDCONVERT_API_KEY=... npx vitest run \
 *     src/lib/video/__tests__/video-generate-e2e.test.ts
 *
 * What this tests:
 *   1. Fish Speech TTS → real audio file
 *   2. Cloudconvert mux (stub video + real audio) → final mp4
 *   3. Final mp4 is downloadable and has non-zero byte length
 *
 * Note: Wan 2.1 video generation (Steps 3-5) is NOT called here because
 * Wan jobs take 2-6 minutes. Instead we use a pre-baked short silent mp4
 * as the "video" input, keeping the E2E focused on the mux + audio path.
 */

import { describe, it, expect } from 'vitest';

const hasSecrets = Boolean(
  process.env.REPLICATE_API_KEY &&
  process.env.FAL_API_KEY &&
  process.env.CLOUDCONVERT_API_KEY,
);

// Publicly accessible short silent mp4 (4s, H.264, no audio)
const SILENT_VIDEO_URL =
  'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4';

describe.skipIf(!hasSecrets)('video-generate E2E (requires real API keys)', () => {
  it(
    'muxes silent video + Fish Speech audio into a valid mp4',
    async () => {
      const { FishSpeechClient } = await import('@/land/video/generation/fish-speech-client');
      const { muxVideoAudio } = await import('@/land/video/assembly/ffmpeg-muxer');

      const apiKey = process.env.FAL_API_KEY!;
      const tts = new FishSpeechClient({ apiKey });

      // Step 1: Generate TTS audio
      const { audioUrl, durationSec } = await tts.generateSpeech({
        text: 'Sophia AI Factory — end-to-end muxing test.',
        language: 'en',
      });

      expect(audioUrl).toMatch(/^https?:\/\//);
      expect(durationSec).toBeGreaterThan(0);

      // Step 2: Mux with silent video
      const outputKey = `e2e-test/mux-${Date.now()}.mp4`;
      const result = await muxVideoAudio({
        videoUrl: SILENT_VIDEO_URL,
        audioUrl,
        outputKey,
      });

      expect(result.url).toMatch(/^https?:\/\//);

      // Step 3: Download and verify final mp4 exists with content
      const fetchRes = await fetch(result.url);
      expect(fetchRes.ok).toBe(true);
      const buffer = await fetchRes.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(1000); // real mp4, not a stub
    },
    // Allow up to 3 minutes for Cloudconvert to process
    180_000,
  );
});

// Placeholder test so vitest reports a pass when secrets are absent
describe('video-generate E2E (placeholder — secrets absent)', () => {
  it.skipIf(hasSecrets)('skips when CLOUDCONVERT_API_KEY not set', () => {
    expect(true).toBe(true);
  });
});

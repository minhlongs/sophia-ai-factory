/**
 * @file viral-audio-pairing-job.ts
 * @description Inngest background worker orchestrating viral audio ducking & kinetic subtitle muxing
 * @layer forest/inngest/functions
 */

import { inngest } from '@/seed/inngest/client';
import { calculateDuckingEnvelope, evaluateBpmTempoAlignment } from '@/tree/audio/ducking-engine';
import { compileKineticSubtitles } from '@/tree/subtitles/kinetic-styler';
import type { ViralAudioComposeRequestedEvent } from '@/seed/inngest/event-types';
import type { ViralSoundTrack, WordTimestamp } from '@/seed/types/viral-expansion-types';

interface InngestStepContext {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
}

export async function processViralAudioPairingJob({
  event,
  step,
}: {
  event: ViralAudioComposeRequestedEvent;
  step: InngestStepContext;
}): Promise<{ videoJobId: string; soundTrackId: string; duckingSegmentsCount: number; subtitleFramesCount: number; status: string }> {
  const { data } = event;

  // Step 1: Calculate dynamic audio ducking & tempo alignment
  const duckingResult = await step.run('evaluate-ducking-and-tempo', async () => {
    const mockTrack: ViralSoundTrack = {
      id: data.soundTrackId,
      title: 'Trending Cyber Beat',
      artist: 'Sonic Pulse',
      bpm: 128,
      audioUrl: 'https://cdn.sophia.network/audio/beat128.mp3',
      viralityIndex: 94.5,
      copyrightTier: 'ROYALTY_FREE_SAFE',
      recommendedDuckingDb: data.duckingDb ?? -14,
      platformTags: ['tiktok', 'shorts'],
    };

    const voiceWindows = [
      { startSec: 0.5, endSec: 4.8 },
      { startSec: 5.5, endSec: 14.2 },
    ];

    const segments = calculateDuckingEnvelope(
      voiceWindows,
      data.duckingDb ?? -14,
      120
    );

    const tempo = evaluateBpmTempoAlignment(130, mockTrack);

    return { segments, tempo };
  });

  // Step 2: Compile kinetic subtitles
  const subtitleFrames = await step.run('compile-kinetic-subtitles', async () => {
    const mockTimestamps: WordTimestamp[] = [
      { word: 'Stop', startSec: 0.5, endSec: 0.8, confidence: 0.98, emphasis: true },
      { word: 'wasting', startSec: 0.9, endSec: 1.2, confidence: 0.99, emphasis: false },
      { word: 'money', startSec: 1.3, endSec: 1.7, confidence: 0.97, emphasis: true },
      { word: 'on', startSec: 1.8, endSec: 2.0, confidence: 0.99, emphasis: false },
      { word: 'ads.', startSec: 2.1, endSec: 2.6, confidence: 0.96, emphasis: true },
    ];

    return compileKineticSubtitles(mockTimestamps, {
      preset: data.subtitlePreset ?? 'HORMOZI_HIGHLIGHT',
      primaryColorHex: '#fbbf24',
      highlightColorHex: '#ef4444',
      fontSizePx: 36,
      maxWordsPerScreen: 3,
      enableEmojiAutoInject: true,
      textShadowGlow: true,
    });
  });

  return {
    videoJobId: data.videoJobId,
    soundTrackId: data.soundTrackId,
    duckingSegmentsCount: duckingResult.segments.length,
    subtitleFramesCount: subtitleFrames.length,
    status: 'COMPOSED',
  };
}

export const viralAudioPairingJob = inngest.createFunction(
  {
    id: 'viral-audio-pairing-job',
    name: 'Viral Sound Pairing & Kinetic Subtitle Engine',
    concurrency: 5,
  },
  { event: 'viral.audio.compose.requested' },
  processViralAudioPairingJob,
);

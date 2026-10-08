/**
 * @file audio-pairing-actions.ts
 * @description Authenticated Server Actions for Viral Sound Pairing & Audio Ducking
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import {
  TriggerAudioPairingInputSchema,
  type TriggerAudioPairingInput,
  type ViralSoundTrack,
} from '@/seed/types/viral-expansion-types';
import { listViralSounds } from '@/tree/dubbing/dubbing-store';
import { logger } from '@/seed/utils/logger-utility';

export async function triggerAudioPairingAction(
  rawInput: TriggerAudioPairingInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return { success: false, error: 'Unauthorized: User session required' };
    }

    const parsed = TriggerAudioPairingInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    await inngest.send({
      name: 'viral.audio.compose.requested',
      data: {
        userId: user.id,
        videoJobId: parsed.data.videoJobId,
        soundTrackId: parsed.data.soundTrackId,
        duckingDb: parsed.data.duckingDb,
        subtitlePreset: parsed.data.subtitlePreset,
      },
    });

    return { success: true };
  } catch (err) {
    logger.error('Failed to trigger audio pairing', { err });
    return { success: false, error: 'Failed to dispatch audio pairing event' };
  }
}

export async function fetchViralSoundsAction(
  limit = 20,
): Promise<{ success: boolean; data?: ViralSoundTrack[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const sounds = await listViralSounds(limit);
    return { success: true, data: sounds };
  } catch (err) {
    logger.error('Failed to fetch viral sound catalog', { err });
    return { success: false, error: 'Failed to retrieve sounds' };
  }
}

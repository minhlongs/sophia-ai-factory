'use client';

import React from 'react';
import type {
  SupportedDubLocale,
  SubtitleAnimationPreset,
} from '@/seed/types/viral-expansion-types';
import { triggerAudioPairingAction } from '@/land/audio/actions/audio-pairing-actions';
import { triggerDubbingAction } from '@/land/dubbing/actions/dubbing-actions';

export function ViralExpansionNotificationBanner({
  notification,
  onDismiss,
}: {
  notification: string | null;
  onDismiss: () => void;
}) {
  if (!notification) return null;
  return (
    <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center justify-between">
      <span>{notification}</span>
      <button onClick={onDismiss} className="text-amber-400 hover:text-amber-200">
        ✕
      </button>
    </div>
  );
}

export async function dispatchAudioPairingWorkflow(params: {
  selectedSoundId: string | null;
  duckingDb: number;
  subtitlePreset: SubtitleAnimationPreset;
  setIsPairing: (val: boolean) => void;
  setNotification: (val: string | null) => void;
}): Promise<void> {
  const { selectedSoundId, duckingDb, subtitlePreset, setIsPairing, setNotification } = params;
  if (!selectedSoundId) return;
  setIsPairing(true);
  setNotification(null);
  try {
    const res = await triggerAudioPairingAction({
      videoJobId: 'job_demo_active',
      soundTrackId: selectedSoundId,
      duckingDb,
      subtitlePreset,
    });
    if (res.success) {
      setNotification('Viral audio composition & ducking envelope successfully dispatched!');
    } else {
      setNotification(`Error: ${res.error}`);
    }
  } finally {
    setIsPairing(false);
  }
}

export async function dispatchMultilingualDubbingWorkflow(params: {
  selectedLocales: SupportedDubLocale[];
  setIsDubbing: (val: boolean) => void;
  setNotification: (val: string | null) => void;
}): Promise<void> {
  const { selectedLocales, setIsDubbing, setNotification } = params;
  if (selectedLocales.length === 0) return;
  setIsDubbing(true);
  setNotification(null);
  try {
    const res = await triggerDubbingAction({
      parentVideoJobId: 'job_demo_active',
      targetLocales: selectedLocales,
      preserveDuration: true,
    });
    if (res.success) {
      setNotification(`Multilingual dubbing workflow dispatched for ${selectedLocales.length} locales!`);
    } else {
      setNotification(`Error: ${res.error}`);
    }
  } finally {
    setIsDubbing(false);
  }
}

/**
 * @file viral-expansion-cockpit-view.tsx
 * @description Master interactive cockpit unifying Audio Pairing, Kinetic Captions & Dubbing Lineages
 * @layer presentation
 */

'use client';

import React, { useState } from 'react';
import { ViralExpansionKpis } from './viral-expansion-kpis';
import { SoundPairingSelector } from './sound-pairing-selector';
import { KineticSubtitleMatrix } from './kinetic-subtitle-matrix';
import { MultilingualDubMatrix } from './multilingual-dub-matrix';
import type {
  ViralSoundTrack,
  LocalizedLineageRecord,
  SupportedDubLocale,
  SubtitleAnimationPreset,
} from '@/seed/types/viral-expansion-types';
import { triggerAudioPairingAction } from '@/land/audio/actions/audio-pairing-actions';
import { triggerDubbingAction } from '@/land/dubbing/actions/dubbing-actions';

interface ViralExpansionCockpitViewProps {
  initialSounds: ViralSoundTrack[];
  initialLineages: LocalizedLineageRecord[];
}

export function ViralExpansionCockpitView({
  initialSounds,
  initialLineages,
}: ViralExpansionCockpitViewProps) {
  const [sounds] = useState<ViralSoundTrack[]>(initialSounds);
  const [lineages, setLineages] = useState<LocalizedLineageRecord[]>(initialLineages);
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(sounds[0]?.id ?? null);
  const [duckingDb, setDuckingDb] = useState<number>(-14);
  const [subtitlePreset, setSubtitlePreset] = useState<SubtitleAnimationPreset>('HORMOZI_HIGHLIGHT');
  const [enableEmoji, setEnableEmoji] = useState<boolean>(true);
  const [selectedLocales, setSelectedLocales] = useState<SupportedDubLocale[]>(['vi', 'es']);
  const [isPairing, setIsPairing] = useState<boolean>(false);
  const [isDubbing, setIsDubbing] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const toggleLocale = (loc: SupportedDubLocale) => {
    setSelectedLocales((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc],
    );
  };

  const handleTriggerAudioPairing = async () => {
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
  };

  const handleTriggerDubbing = async () => {
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
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-amber-400 hover:text-amber-200">
            ✕
          </button>
        </div>
      )}

      <ViralExpansionKpis
        totalLineages={lineages.length}
        totalViralSounds={sounds.length}
        activeLocalesCount={selectedLocales.length}
        avgPacingStretch={1.04}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SoundPairingSelector
          sounds={sounds}
          selectedSoundId={selectedSoundId}
          duckingDb={duckingDb}
          onSelectSound={setSelectedSoundId}
          onChangeDuckingDb={setDuckingDb}
          onTriggerPairing={handleTriggerAudioPairing}
          isPairing={isPairing}
        />

        <KineticSubtitleMatrix
          selectedPreset={subtitlePreset}
          onSelectPreset={setSubtitlePreset}
          enableEmoji={enableEmoji}
          onToggleEmoji={setEnableEmoji}
        />
      </div>

      <MultilingualDubMatrix
        selectedLocales={selectedLocales}
        onToggleLocale={toggleLocale}
        lineages={lineages}
        onTriggerDubbing={handleTriggerDubbing}
        isDubbing={isDubbing}
      />
    </div>
  );
}

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
import {
  ViralExpansionNotificationBanner,
  dispatchAudioPairingWorkflow,
  dispatchMultilingualDubbingWorkflow,
} from './viral-expansion-action-handlers';
import type {
  ViralSoundTrack,
  LocalizedLineageRecord,
  SupportedDubLocale,
  SubtitleAnimationPreset,
} from '@/seed/types/viral-expansion-types';

export {
  ViralExpansionNotificationBanner,
  dispatchAudioPairingWorkflow,
  dispatchMultilingualDubbingWorkflow,
};

export interface ViralExpansionCockpitViewProps {
  initialSounds: ViralSoundTrack[];
  initialLineages: LocalizedLineageRecord[];
}

export function ViralExpansionCockpitView({
  initialSounds,
  initialLineages,
}: ViralExpansionCockpitViewProps) {
  const [sounds] = useState<ViralSoundTrack[]>(initialSounds);
  const [lineages] = useState<LocalizedLineageRecord[]>(initialLineages);
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

  return (
    <div className="space-y-6">
      <ViralExpansionNotificationBanner
        notification={notification}
        onDismiss={() => setNotification(null)}
      />

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
          onTriggerPairing={() =>
            dispatchAudioPairingWorkflow({
              selectedSoundId,
              duckingDb,
              subtitlePreset,
              setIsPairing,
              setNotification,
            })
          }
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
        onTriggerDubbing={() =>
          dispatchMultilingualDubbingWorkflow({
            selectedLocales,
            setIsDubbing,
            setNotification,
          })
        }
        isDubbing={isDubbing}
      />
    </div>
  );
}

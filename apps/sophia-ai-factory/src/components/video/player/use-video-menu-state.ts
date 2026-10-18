'use client';

import { useState, useCallback, type RefObject } from 'react';
import type { QualityLadder } from '@/seed/types/streaming';
import type { SubtitleLanguage } from './player-types';
import { usePlayerTracks, useQualitySwitch } from './player-stream-source';

export interface UseVideoMenuStateParams {
  videoId: string;
  manifestUrl: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  initialQuality: 'auto' | QualityLadder;
  initialSubtitleLocale: SubtitleLanguage;
}

export function useVideoMenuState({
  videoId,
  manifestUrl,
  videoRef,
  initialQuality,
  initialSubtitleLocale,
}: UseVideoMenuStateParams) {
  const [selectedQuality, setSelectedQuality] = useState<'auto' | QualityLadder>(initialQuality);
  const [selectedSubtitle, setSelectedSubtitle] = useState<SubtitleLanguage>(initialSubtitleLocale);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState<boolean>(false);

  const { handleSubtitleSelect: applySubtitle } = usePlayerTracks(videoRef);
  const { handleQualitySelect: applyQuality } = useQualitySwitch(videoId, manifestUrl, videoRef);

  const handleQualitySelect = useCallback(
    (quality: 'auto' | QualityLadder) => {
      setShowQualityMenu(false);
      applyQuality(quality, setSelectedQuality);
    },
    [applyQuality],
  );

  const handleSubtitleSelect = useCallback(
    (lang: SubtitleLanguage) => {
      setShowSubtitleMenu(false);
      applySubtitle(lang, setSelectedSubtitle);
    },
    [applySubtitle],
  );

  return {
    selectedQuality,
    selectedSubtitle,
    showControls,
    showQualityMenu,
    showSubtitleMenu,
    setShowControls,
    setShowQualityMenu,
    setShowSubtitleMenu,
    handleQualitySelect,
    handleSubtitleSelect,
  };
}

'use client';

/**
 * Adaptive Video Player Media Stream Source Resolution
 *
 * @module components/video/player/player-stream-source
 */

import { useCallback } from 'react';
import type { QualityLadder } from '@/seed/types/streaming';
import type { SubtitleLanguage } from './player-types';

export function usePlayerTracks(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const handleSubtitleSelect = useCallback(
    (lang: SubtitleLanguage, onSelected: (l: SubtitleLanguage) => void) => {
      onSelected(lang);
      const video = videoRef.current;
      if (!video) return;

      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        track.mode = lang === 'off' ? 'disabled' : (track.language === lang ? 'showing' : 'disabled');
      }
    },
    [videoRef],
  );

  return { handleSubtitleSelect };
}

export function useQualitySwitch(
  videoId: string,
  manifestUrl: string,
  videoRef: React.RefObject<HTMLVideoElement | null>,
) {
  const handleQualitySelect = useCallback(
    (quality: 'auto' | QualityLadder, onSelected: (q: 'auto' | QualityLadder) => void) => {
      onSelected(quality);
      const video = videoRef.current;
      if (!video) return;

      const currentPos = video.currentTime;
      const wasPlaying = !video.paused;

      video.src = quality === 'auto'
        ? manifestUrl
        : `/api/videos/${encodeURIComponent(videoId)}/url?quality=${quality}`;

      video.currentTime = currentPos;
      if (wasPlaying) void video.play();
    },
    [videoId, manifestUrl, videoRef],
  );

  return { handleQualitySelect };
}

'use client';

/**
 * Adaptive Video Player Media Event Listeners
 *
 * @module components/video/player/player-media-events
 */

import { useEffect } from 'react';

export interface PlayerMediaEventsProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  setDuration: (d: number) => void;
  setCurrentTime: (t: number) => void;
  setIsPlaying: (p: boolean) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

export function usePlayerMediaEvents({
  videoRef,
  setDuration,
  setCurrentTime,
  setIsPlaying,
  onTimeUpdate,
  onEnded,
}: PlayerMediaEventsProps) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => setDuration(video.duration || 0);
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime, video.duration || 0);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [videoRef, setDuration, setCurrentTime, setIsPlaying, onTimeUpdate, onEnded]);
}

'use client';

/**
 * Adaptive Video Player Playback Helpers
 *
 * Encapsulates media element control actions (play/pause, volume, mute, seek, fullscreen)
 * and manifest URL resolution for `useVideoPlayback`.
 *
 * @module components/video/player/video-playback-helpers
 */

import { useCallback, type RefObject } from 'react';
import type { AdaptiveVideoPlayerProps } from './player-types';

export type UseVideoPlaybackProps = Pick<
  AdaptiveVideoPlayerProps,
  | 'videoId'
  | 'src'
  | 'tenantId'
  | 'userId'
  | 'customWatermarkText'
  | 'initialQuality'
  | 'initialSubtitleLocale'
  | 'onTimeUpdate'
  | 'onEnded'
>;

export interface VideoControlHandlersParams {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  isMuted: boolean;
  volume: number;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setVolume: (vol: number) => void;
  setIsMuted: (muted: boolean) => void;
  setIsFullscreen: (fullscreen: boolean) => void;
}

export function resolveVideoManifestUrl(videoId: string, src?: string): string {
  if (src) return src;
  return `/api/videos/${encodeURIComponent(videoId)}/hls`;
}

export function useVideoControlHandlers({
  videoRef,
  containerRef,
  isMuted,
  volume,
  setIsPlaying,
  setCurrentTime,
  setVolume,
  setIsMuted,
  setIsFullscreen,
}: VideoControlHandlersParams) {
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [videoRef, setIsPlaying]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value);
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
      if (videoRef.current) {
        videoRef.current.volume = newVolume;
        videoRef.current.muted = newVolume === 0;
      }
    },
    [videoRef, setVolume, setIsMuted],
  );

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
    if (!nextMuted && volume === 0) {
      setVolume(0.5);
      videoRef.current.volume = 0.5;
    }
  }, [videoRef, isMuted, volume, setIsMuted, setVolume]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const seekTime = parseFloat(e.target.value);
      setCurrentTime(seekTime);
      if (videoRef.current) videoRef.current.currentTime = seekTime;
    },
    [videoRef, setCurrentTime],
  );

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch {
        // Fallback
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch {
        // Fallback
      }
    }
  }, [containerRef, setIsFullscreen]);

  return {
    togglePlay,
    handleVolumeChange,
    toggleMute,
    handleSeek,
    toggleFullscreen,
  };
}

'use client';

/**
 * Adaptive Video Player Playback Hook
 *
 * Encapsulates playback state, time updates, quality and subtitle handlers.
 *
 * @module components/video/player/use-video-playback
 */

import { useState, useRef, useMemo } from 'react';
import { generateForensicWatermark } from '@/tree/watermark/forensic-watermark';
import { usePlayerMediaEvents } from './player-media-events';
import {
  resolveVideoManifestUrl,
  useVideoControlHandlers,
  type UseVideoPlaybackProps,
  type VideoControlHandlersParams,
} from './video-playback-helpers';
import { useVideoMenuState, type UseVideoMenuStateParams } from './use-video-menu-state';

export {
  resolveVideoManifestUrl,
  useVideoControlHandlers,
  useVideoMenuState,
  type UseVideoPlaybackProps,
  type VideoControlHandlersParams,
  type UseVideoMenuStateParams,
};

export function useVideoPlayback({
  videoId,
  src,
  tenantId = 'tenant_default',
  userId = 'usr_anonymous',
  customWatermarkText,
  initialQuality = 'auto',
  initialSubtitleLocale = 'vi',
  onTimeUpdate,
  onEnded,
}: UseVideoPlaybackProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const watermark = useMemo(
    () => generateForensicWatermark(tenantId, userId, customWatermarkText),
    [tenantId, userId, customWatermarkText],
  );
  const manifestUrl = useMemo(() => resolveVideoManifestUrl(videoId, src), [src, videoId]);

  const menuState = useVideoMenuState({
    videoId,
    manifestUrl,
    videoRef,
    initialQuality,
    initialSubtitleLocale,
  });

  const controlHandlers = useVideoControlHandlers({
    videoRef,
    containerRef,
    isMuted,
    volume,
    setIsPlaying,
    setCurrentTime,
    setVolume,
    setIsMuted,
    setIsFullscreen,
  });

  usePlayerMediaEvents({
    videoRef,
    setDuration,
    setCurrentTime,
    setIsPlaying,
    onTimeUpdate,
    onEnded,
  });

  return {
    videoRef,
    containerRef,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isFullscreen,
    watermark,
    manifestUrl,
    setVolume,
    setIsFullscreen,
    ...menuState,
    ...controlHandlers,
  };
}

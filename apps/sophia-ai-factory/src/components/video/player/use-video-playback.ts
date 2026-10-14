'use client';

/**
 * Adaptive Video Player Playback Hook
 *
 * Encapsulates playback state, time updates, quality and subtitle handlers.
 *
 * @module components/video/player/use-video-playback
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import type { QualityLadder } from '@/seed/types/streaming';
import { generateForensicWatermark } from '@/tree/watermark/forensic-watermark';
import type { SubtitleLanguage } from './player-types';
import { usePlayerTracks, useQualitySwitch } from './player-stream-source';
import { usePlayerMediaEvents } from './player-media-events';
import {
  resolveVideoManifestUrl,
  useVideoControlHandlers,
  type UseVideoPlaybackProps,
  type VideoControlHandlersParams,
} from './video-playback-helpers';

export {
  resolveVideoManifestUrl,
  useVideoControlHandlers,
  type UseVideoPlaybackProps,
  type VideoControlHandlersParams,
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
  const [selectedQuality, setSelectedQuality] = useState<'auto' | QualityLadder>(initialQuality);
  const [selectedSubtitle, setSelectedSubtitle] = useState<SubtitleLanguage>(initialSubtitleLocale);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState<boolean>(false);

  const watermark = useMemo(
    () => generateForensicWatermark(tenantId, userId, customWatermarkText),
    [tenantId, userId, customWatermarkText],
  );

  const manifestUrl = useMemo(() => resolveVideoManifestUrl(videoId, src), [src, videoId]);

  const { handleSubtitleSelect: applySubtitle } = usePlayerTracks(videoRef);
  const { handleQualitySelect: applyQuality } = useQualitySwitch(videoId, manifestUrl, videoRef);

  const {
    togglePlay,
    handleVolumeChange,
    toggleMute,
    handleSeek,
    toggleFullscreen,
  } = useVideoControlHandlers({
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
    selectedQuality,
    selectedSubtitle,
    showControls,
    showQualityMenu,
    showSubtitleMenu,
    watermark,
    manifestUrl,
    setShowControls,
    setShowQualityMenu,
    setShowSubtitleMenu,
    togglePlay,
    toggleMute,
    toggleFullscreen,
    handleSeek,
    handleVolumeChange,
    handleQualitySelect,
    handleSubtitleSelect,
    setVolume,
    setIsFullscreen,
  };
}

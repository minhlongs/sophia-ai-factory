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
import type { AdaptiveVideoPlayerProps, SubtitleLanguage } from './player-types';
import { usePlayerTracks, useQualitySwitch } from './player-stream-source';
import { usePlayerMediaEvents } from './player-media-events';

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
}: Pick<
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
>) {
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

  const manifestUrl = useMemo(() => {
    if (src) return src;
    return `/api/videos/${encodeURIComponent(videoId)}/hls`;
  }, [src, videoId]);

  const { handleSubtitleSelect: applySubtitle } = usePlayerTracks(videoRef);
  const { handleQualitySelect: applyQuality } = useQualitySwitch(videoId, manifestUrl, videoRef);

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
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
    if (!nextMuted && volume === 0) {
      setVolume(0.5);
      videoRef.current.volume = 0.5;
    }
  }, [isMuted, volume]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (videoRef.current) videoRef.current.currentTime = seekTime;
  }, []);

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
  }, []);

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

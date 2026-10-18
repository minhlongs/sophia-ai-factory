'use client';

/**
 * Adaptive Video Player Composed View
 *
 * Layer: tree/forest presentation component
 *
 * @module components/video/player/adaptive-video-player-view
 */

import React from 'react';
import type { AdaptiveVideoPlayerProps } from './player-types';
import { useVideoPlayback } from './use-video-playback';
import { PlayerControlsBar } from './player-controls-bar';
import { usePlayerKeyboardAndFullscreen } from './player-keyboard-subtitles';
import { AdaptiveVideoStage } from './adaptive-video-stage';

export function AdaptiveVideoPlayerView({
  videoId,
  src,
  title,
  poster,
  autoPlay = false,
  tenantId = 'tenant_default',
  userId = 'usr_anonymous',
  customWatermarkText,
  enableForensicWatermark = true,
  initialQuality = 'auto',
  initialSubtitleLocale = 'vi',
  onTimeUpdate,
  onEnded,
  className = '',
}: AdaptiveVideoPlayerProps) {
  const {
    videoRef,
    containerRef,
    manifestUrl,
    watermark,
    setVolume,
    setIsFullscreen,
    setShowControls,
    ...controlsProps
  } = useVideoPlayback({
    videoId,
    src,
    tenantId,
    userId,
    customWatermarkText,
    initialQuality,
    initialSubtitleLocale,
    onTimeUpdate,
    onEnded,
  });

  usePlayerKeyboardAndFullscreen({
    videoRef,
    togglePlay: controlsProps.togglePlay,
    toggleMute: controlsProps.toggleMute,
    toggleFullscreen: controlsProps.toggleFullscreen,
    setVolume,
    setIsFullscreen,
  });

  return (
    <div
      ref={containerRef}
      className={`group relative overflow-hidden rounded-2xl bg-black text-white shadow-2xl ${className}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => {
        if (controlsProps.isPlaying) setShowControls(false);
      }}
      role="region"
      aria-label={title || 'Adaptive HLS Video Player'}
    >
      <AdaptiveVideoStage
        videoRef={videoRef}
        videoId={videoId}
        manifestUrl={manifestUrl}
        poster={poster}
        autoPlay={autoPlay}
        title={title}
        isPlaying={controlsProps.isPlaying}
        selectedSubtitle={controlsProps.selectedSubtitle}
        watermark={watermark}
        enableForensicWatermark={enableForensicWatermark}
        togglePlay={controlsProps.togglePlay}
      />

      <PlayerControlsBar {...controlsProps} />
    </div>
  );
}

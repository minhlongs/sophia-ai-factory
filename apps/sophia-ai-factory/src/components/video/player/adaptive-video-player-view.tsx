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
import { PlayerWatermarkOverlay } from './player-watermark-overlay';
import { PlayerControlsBar } from './player-controls-bar';
import {
  PlayerCenterPlayOverlay,
  usePlayerKeyboardAndFullscreen,
  VideoSubtitleTracks,
} from './player-keyboard-subtitles';

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
    isPlaying,
    isMuted,
    isFullscreen,
    volume,
    currentTime,
    duration,
    showControls,
    selectedQuality,
    selectedSubtitle,
    showQualityMenu,
    showSubtitleMenu,
    manifestUrl,
    watermark,
    setVolume,
    setIsFullscreen,
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
    togglePlay,
    toggleMute,
    toggleFullscreen,
    setVolume,
    setIsFullscreen,
  });

  return (
    <div
      ref={containerRef}
      className={`group relative overflow-hidden rounded-2xl bg-black text-white shadow-2xl ${className}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
      role="region"
      aria-label={title || 'Adaptive HLS Video Player'}
    >
      <video
        ref={videoRef}
        src={manifestUrl}
        poster={poster}
        autoPlay={autoPlay}
        playsInline
        className="h-full w-full object-contain cursor-pointer"
        onClick={togglePlay}
        aria-label={title || 'Video playback'}
      >
        <VideoSubtitleTracks videoId={videoId} selectedSubtitle={selectedSubtitle} />
      </video>

      <PlayerWatermarkOverlay
        watermark={watermark}
        enableForensicWatermark={enableForensicWatermark}
      />

      <PlayerCenterPlayOverlay isPlaying={isPlaying} />

      <PlayerControlsBar
        isPlaying={isPlaying}
        isMuted={isMuted}
        isFullscreen={isFullscreen}
        volume={volume}
        currentTime={currentTime}
        duration={duration}
        showControls={showControls}
        selectedQuality={selectedQuality}
        selectedSubtitle={selectedSubtitle}
        showQualityMenu={showQualityMenu}
        showSubtitleMenu={showSubtitleMenu}
        setShowQualityMenu={setShowQualityMenu}
        setShowSubtitleMenu={setShowSubtitleMenu}
        togglePlay={togglePlay}
        toggleMute={toggleMute}
        toggleFullscreen={toggleFullscreen}
        handleSeek={handleSeek}
        handleVolumeChange={handleVolumeChange}
        handleQualitySelect={handleQualitySelect}
        handleSubtitleSelect={handleSubtitleSelect}
      />
    </div>
  );
}

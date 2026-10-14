'use client';

/**
 * Adaptive Video Player Composed View
 *
 * Layer: tree/forest presentation component
 *
 * @module components/video/player/adaptive-video-player-view
 */

import React from 'react';
import { Play } from 'lucide-react';
import type { AdaptiveVideoPlayerProps } from './player-types';
import { useVideoPlayback } from './use-video-playback';
import { PlayerWatermarkOverlay } from './player-watermark-overlay';
import { PlayerControlsBar } from './player-controls-bar';
import {
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

      <PlayerWatermarkOverlay watermark={watermark} enableForensicWatermark={enableForensicWatermark} />

      {!isPlaying && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity" aria-hidden="true">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg backdrop-blur-md">
            <Play className="h-8 w-8 ml-1" />
          </div>
        </div>
      )}

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

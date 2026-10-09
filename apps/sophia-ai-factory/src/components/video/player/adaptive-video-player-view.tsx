'use client';

/**
 * Adaptive Video Player Composed View
 *
 * Layer: tree/forest presentation component
 *
 * @module components/video/player/adaptive-video-player-view
 */

import React, { useEffect } from 'react';
import { Play } from 'lucide-react';
import type { AdaptiveVideoPlayerProps } from './player-types';
import { useVideoPlayback } from './use-video-playback';
import { PlayerWatermarkOverlay } from './player-watermark-overlay';
import { PlayerControlsBar } from './player-controls-bar';

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          void toggleFullscreen();
          break;
        case 'arrowleft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case 'arrowright':
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
          break;
        case 'arrowup':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          setVolume(video.volume);
          break;
        case 'arrowdown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          setVolume(video.volume);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleMute, toggleFullscreen, videoRef, setVolume]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [setIsFullscreen]);

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
        <track kind="subtitles" src={`/api/videos/${encodeURIComponent(videoId)}/subtitles/vi.vtt`} srcLang="vi" label="Tiếng Việt" default={selectedSubtitle === 'vi'} />
        <track kind="subtitles" src={`/api/videos/${encodeURIComponent(videoId)}/subtitles/en.vtt`} srcLang="en" label="English" default={selectedSubtitle === 'en'} />
        <track kind="subtitles" src={`/api/videos/${encodeURIComponent(videoId)}/subtitles/ja.vtt`} srcLang="ja" label="日本語" default={selectedSubtitle === 'ja'} />
        <track kind="subtitles" src={`/api/videos/${encodeURIComponent(videoId)}/subtitles/ko.vtt`} srcLang="ko" label="한국어" default={selectedSubtitle === 'ko'} />
        <track kind="subtitles" src={`/api/videos/${encodeURIComponent(videoId)}/subtitles/th.vtt`} srcLang="th" label="ไทย" default={selectedSubtitle === 'th'} />
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

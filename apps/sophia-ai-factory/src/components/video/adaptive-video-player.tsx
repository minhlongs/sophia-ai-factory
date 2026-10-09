'use client';

/**
 * Adaptive Video Player Component Facade
 *
 * Backward-compatible facade delegating to modularized player components.
 *
 * @module components/video/adaptive-video-player
 */

export { AdaptiveVideoPlayerView as AdaptiveVideoPlayer } from './player/adaptive-video-player-view';
export * from './player/player-types';
export * from './player/player-watermark-overlay';
export * from './player/player-subtitles-menu';
export * from './player/player-quality-menu';
export * from './player/player-controls-bar';

/**
 * Video Domain Public API
 *
 * Barrel export for all video domain functionality.
 * External code should import from '@/land/video' only.
 *
 * @module land/video
 */

// ============================================================================
// Generation Subdomain
// ============================================================================
// AI video generation pipeline

export * from './generation/tts-client';
export * from './generation/fish-speech-client';
export * from './generation/wan21-client';
export * from './generation/kling-client';
export * from './generation/video-render-provider';
export * from './generation/video-job-fsm';
export * from './generation/video-job-pipeline';
export * from './generation/visual-prompt-generator';
export * from './generation/highlight-scorer';
export * from './generation/one-time-welcome-script';
export * from './generation/assemblyai-client';

// ============================================================================
// Assembly Subdomain
// ============================================================================
// Video composition and effects

export * from './assembly/composer-ffmpeg';
export * from './assembly/ffmpeg-muxer';
export * from './assembly/clip-boundary-merger';
export * from './assembly/subtitle-generator';
export * from './assembly/vertical-cropper';
export { composeWithDisclosure } from './assembly/ftc-disclosure-overlay';
export type { DisclosureOptions, ComposedResult } from './assembly/ftc-disclosure-overlay';

export { composeWithCryptoDisclaimer } from './assembly/crypto-disclaimer-overlay';
export type { CryptoOverlayOptions, CryptoOverlayResult } from './assembly/crypto-disclaimer-overlay';
export * from './assembly/brand-kit-composer';

// ============================================================================
// Storage Subdomain
// ============================================================================
// R2 uploads and URL management

export * from './storage/r2-binding';
export * from './storage/r2-multipart-upload';
export * from './storage/video-storage-service';
export * from './storage/get-canonical-video-url';

// ============================================================================
// Publishing Subdomain
// ============================================================================
// Platform distribution and access control

export * from './publishing/path-a-template';
export * from './publishing/path-b-cinematic';
export * from './publishing/video-access-control';

// ============================================================================
// Templates Subdomain
// ============================================================================
// Shared types, utilities, and template handlers

export * from './templates/types';
export * from './templates/onboarding-video';
export * from './templates/cost-guardrail';
export * from './templates/circuit-breaker';
export * from './templates/cost-ledger';
export * from './templates/scene-detector';
export * from './templates/thumbnail-client';
export * from './templates/thumbnail-variant-generator';
export * from './templates/heygen-helpers';
export * from './templates/visual-router';
export * from './templates/batch-csv-parser';

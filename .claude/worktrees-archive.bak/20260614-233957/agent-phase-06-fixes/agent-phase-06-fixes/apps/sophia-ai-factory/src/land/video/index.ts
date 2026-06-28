/**
 * Video Library — Public API
 *
 * Barrel re-export for Wan 2.1 + Fish Speech clients and shared types.
 * Internal helpers (r2-binding, cost-ledger, fsm, etc.) NOT re-exported here.
 */

export { WanVideoClient, WanVideoClientError } from './wan21-client';
export type { WanVideoClientConfig } from './wan21-client';

export { FishSpeechClient, FishSpeechClientError } from './fish-speech-client';
export type { FishSpeechClientConfig } from './fish-speech-client';

export type {
  VideoAspectRatio,
  WanJobStatus,
  VideoGenerateParams,
  VideoGenerateResult,
  VideoJobStatus,
  SupportedLanguage,
  SpeechGenerateParams,
  SpeechGenerateResult,
  VideoGenerateRequestedEvent,
} from './types';

/**
 * Constants and types for campaign streaming service.
 * @module forest/streaming/campaign/types
 */

export type {
  CampaignStreamEvent,
  CampaignStreamEventBase,
  CampaignStreamEventType,
  ErrorEvent,
  HeartbeatEvent,
  ProgressUpdateEvent,
  StatusChangeEvent,
  StepCompleteEvent,
  StreamEndEvent,
  StreamState,
} from '../campaign-stream-types';

/** Default poll interval in milliseconds. */
export const DEFAULT_POLL_MS = 3_000;

/** Maximum stream duration in milliseconds (stay under CF 60 s limit). */
export const MAX_STREAM_DURATION_MS = 58_000;

/** Heartbeat interval in milliseconds. */
export const HEARTBEAT_MS = 15_000;

/** Maximum consecutive DB errors before the stream ends with an error event. */
export const MAX_CONSECUTIVE_ERRORS = 5;

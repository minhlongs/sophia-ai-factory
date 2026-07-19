/**
 * @module campaign-stream-types
 * TypeScript interfaces for SSE campaign progress events.
 *
 * Event contract between server (route.ts + service.ts) and client (use-campaign-stream.ts).
 * All events share a base shape; each variant adds its own payload fields.
 */

/** Base fields present on every SSE event. */
export interface CampaignStreamEventBase {
  /** Discriminator — one of the known event types. */
  type: CampaignStreamEventType;
  /** ISO-8601 timestamp set by the server at emit time. */
  timestamp: string;
  /** Campaign identifier this event belongs to. */
  campaignId: string;
}

/** Progress update — emitted when campaign progress changes. */
export interface ProgressUpdateEvent extends CampaignStreamEventBase {
  type: 'progress_update';
  /** Integer 0-100. */
  progress: number;
  /** Human-readable label, e.g. "Generating script…" */
  label: string;
  /** Optional current step name. */
  currentStep?: string;
}

/** Status change — emitted when the campaign status transitions. */
export interface StatusChangeEvent extends CampaignStreamEventBase {
  type: 'status_change';
  /** Previous status value. */
  previousStatus: string;
  /** New status value. */
  status: string;
}

/** Step complete — emitted when a campaign checkpoint is recorded. */
export interface StepCompleteEvent extends CampaignStreamEventBase {
  type: 'step_complete';
  /** Checkpoint step name. */
  step: string;
  /** ISO-8601 completion timestamp from D1. */
  completedAt: string;
  /** Raw metadata JSON from the checkpoint row. */
  metadata: Record<string, unknown>;
}

/** Error — emitted when the campaign hits a failure state. */
export interface ErrorEvent extends CampaignStreamEventBase {
  type: 'error';
  /** Machine-readable error code. */
  code: string;
  /** Human-readable error message. */
  message: string;
  /** Whether the error is terminal (campaign will not recover). */
  terminal: boolean;
}

/** Heartbeat — emitted every 15 s to keep the connection alive. */
export interface HeartbeatEvent extends CampaignStreamEventBase {
  type: 'heartbeat';
  /** Seconds since the stream started. */
  uptime: number;
}

/** Stream end — emitted when the server closes the stream. */
export interface StreamEndEvent extends CampaignStreamEventBase {
  type: 'stream_end';
  /** Final campaign status at stream close. */
  finalStatus: string;
  /** Final progress value at stream close. */
  finalProgress: number;
}

/** Discriminated union of all possible SSE event types. */
export type CampaignStreamEvent =
  | ProgressUpdateEvent
  | StatusChangeEvent
  | StepCompleteEvent
  | ErrorEvent
  | HeartbeatEvent
  | StreamEndEvent;

/** All valid event type string literals. */
export type CampaignStreamEventType =
  | 'progress_update'
  | 'status_change'
  | 'step_complete'
  | 'error'
  | 'heartbeat'
  | 'stream_end';

/** Internal state tracked by the stream service between poll cycles. */
export interface StreamState {
  /** Timestamp of the last checkpoint we have already emitted. */
  lastCheckpointAt: string;
  /** Previously seen campaign status (for change detection). */
  lastStatus: string;
  /** Previously seen progress value (for change detection). */
  lastProgress: number;
}

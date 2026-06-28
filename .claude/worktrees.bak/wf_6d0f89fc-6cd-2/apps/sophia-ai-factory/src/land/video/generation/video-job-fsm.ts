/**
 * Video Job Finite State Machine
 *
 * Defines all valid states and transitions for the video generation pipeline.
 * Guards prevent illegal state changes and double-fire.
 */

export type VideoJobStatus =
  | 'queued'
  | 'scripting'
  | 'tts_pending'
  | 'visual_pending'
  | 'composing'
  | 'uploaded'
  | 'published'
  | 'failed';

export interface FsmTransition {
  from: VideoJobStatus;
  to: VideoJobStatus;
}

/** All valid forward transitions in pipeline order */
export const FSM_TRANSITIONS: FsmTransition[] = [
  { from: 'queued', to: 'scripting' },
  { from: 'scripting', to: 'tts_pending' },
  { from: 'tts_pending', to: 'visual_pending' },
  { from: 'visual_pending', to: 'composing' },
  { from: 'composing', to: 'uploaded' },
  { from: 'uploaded', to: 'published' },
  // Any non-terminal state can transition to failed
  { from: 'queued', to: 'failed' },
  { from: 'scripting', to: 'failed' },
  { from: 'tts_pending', to: 'failed' },
  { from: 'visual_pending', to: 'failed' },
  { from: 'composing', to: 'failed' },
  { from: 'uploaded', to: 'failed' },
];

/** Terminal states — no further transitions allowed */
export const TERMINAL_STATES: ReadonlySet<VideoJobStatus> = new Set([
  'published',
  'failed',
]);

/**
 * Check whether a transition from `current` to `next` is valid.
 * Returns true only if the pair exists in FSM_TRANSITIONS.
 */
export function isValidTransition(
  current: VideoJobStatus,
  next: VideoJobStatus,
): boolean {
  if (TERMINAL_STATES.has(current)) return false;
  return FSM_TRANSITIONS.some((t) => t.from === current && t.to === next);
}

/**
 * Guard for idempotent re-fire:
 * Returns true if current status is already `target` (no-op is safe).
 */
export function isAlreadyIn(
  current: VideoJobStatus,
  target: VideoJobStatus,
): boolean {
  return current === target;
}

/**
 * Assert that a transition is valid; throws if not.
 * Call this inside an Inngest step before persisting the new state.
 */
export function assertValidTransition(
  current: VideoJobStatus,
  next: VideoJobStatus,
): void {
  if (isAlreadyIn(current, next)) return; // idempotent re-fire — ok
  if (!isValidTransition(current, next)) {
    throw new Error(
      `[VideoJobFSM] Illegal transition: ${current} → ${next}`,
    );
  }
}

/** Progress percentage for each status (used by polling endpoint) */
export const STATUS_PROGRESS: Record<VideoJobStatus, number> = {
  queued: 0,
  scripting: 15,
  tts_pending: 30,
  visual_pending: 50,
  composing: 70,
  uploaded: 85,
  published: 100,
  failed: 0,
};

/**
 * Mission SSE Stream Types and Constants
 *
 * Layer: app/api/v1/missions/[id]/stream/pipeline
 */

export const POLL_INTERVAL_MS = 2000;
export const MAX_DURATION_MS = 5 * 60 * 1000;
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);

export interface MissionRow {
  id: string;
  command: string;
  status: string;
  result: string | null;
  error: string | null;
  credits_used: number;
  updated_at: number;
  completed_at: number | null;
}

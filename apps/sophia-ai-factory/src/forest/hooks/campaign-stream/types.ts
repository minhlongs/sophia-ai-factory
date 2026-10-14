/**
 * Campaign Stream Hook Types & Constants
 *
 * Layer: forest/hooks/campaign-stream
 */

import type { CampaignStreamEvent } from '@/forest/streaming/campaign-stream-types';

export const RECONNECT_BASE_MS = 1_000;
export const MAX_BACKOFF_MS = 30_000;
export const MAX_RETRIES = 5;
export const MAX_EVENTS = 500;

export interface UseCampaignStreamResult {
  /** All received events, newest first. */
  events: CampaignStreamEvent[];
  /** True while the EventSource connection is open. */
  connected: boolean;
  /** Last stream error (if any). Null when connected or not yet attempted. */
  error: string | null;
  /** Clear the accumulated events buffer. */
  clearEvents: () => void;
}

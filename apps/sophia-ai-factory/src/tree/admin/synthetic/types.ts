/**
 * Synthetic Fulfillment Types & Constants
 *
 * Layer: tree/admin/synthetic
 */

import type { ONE_TIME_SKUS } from '@/seed/config/one-time-skus';
import type { OneTimeSkuId } from '@/seed/types';

export const POLL_INTERVAL_MS = 3_000;
export const DEFAULT_TIMEOUT_MS = 60_000;

export interface SyntheticTimeline {
  paid_at: number;
  queued_at: number | null;
  processing_at: number | null;
  completed_at: number | null;
  email_sent_at: number | null;
}

export interface SyntheticDeltasMs {
  paid_to_queued: number | null;
  queued_to_processing: number | null;
  processing_to_completed: number | null;
  total: number | null;
}

export interface SyntheticRunResult {
  payment_id: string;
  purchase_id: string | null;
  video_id: string | null;
  outcome: 'completed' | 'timeout' | 'failed';
  timeline: SyntheticTimeline;
  deltas_ms: SyntheticDeltasMs;
  errors: string[];
}

export interface BillingEventRow {
  event_type: string;
}

export interface VideoRow {
  id: string;
  status: string;
}

export type OneTimeFulfillmentTrigger = (
  userId: string,
  purchaseId: string,
  sku: (typeof ONE_TIME_SKUS)[OneTimeSkuId],
) => Promise<unknown>;

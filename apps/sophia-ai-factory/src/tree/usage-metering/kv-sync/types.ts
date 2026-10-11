/**
 * Usage KV Sync Types & Constants
 *
 * @module usage-metering/kv-sync/types
 */

export type {
  BatchUsageRecord,
  IngestionResult,
  BatchIngestionResponse,
  QuotaCheckResult,
  LicenseMetadataRow,
} from '../types';

/** Aggregated KV counter entry keyed by userId:service */
export interface KvCounterEntry {
  userId: string;
  service: string;
  totalCredits: number;
  totalRequests: number;
  /** Unix seconds of the most recent record in this batch */
  lastSeenAt: number;
}

/** KV TTL for real-time usage counters: 24 hours */
export const KV_COUNTER_TTL_SECONDS = 86400;

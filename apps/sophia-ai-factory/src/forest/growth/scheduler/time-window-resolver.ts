/**
 * @file time-window-resolver.ts
 * @description Off-peak time window resolution and database mapping helpers.
 * @layer forest
 */

import type { D1Database } from '@cloudflare/workers-types';
import { createServerClient } from '@/seed/db/client';
import {
  isOffPeakUtcHour,
  OFF_PEAK_START_HOUR_UTC,
  OFF_PEAK_END_HOUR_UTC,
} from '@/tree/growth-v11/compute-arbitrage';
import type { SophiaTier, ComputePriority, ComputeModelTier } from '@/seed/types/growth-triad-v11';
import type { ComputeJobRow, ComputeJobRecord, ComputeJobStatus } from './types';

export function isOffPeakNow(date: Date = new Date()): boolean {
  return isOffPeakUtcHour(date.getUTCHours());
}

export function calculateNextOffPeakStartSec(now: Date = new Date()): number {
  const target = new Date(now.getTime());
  target.setUTCMinutes(0, 0, 0);
  const currentHour = target.getUTCHours();

  if (currentHour < OFF_PEAK_START_HOUR_UTC) {
    target.setUTCHours(OFF_PEAK_START_HOUR_UTC);
  } else if (currentHour >= OFF_PEAK_END_HOUR_UTC) {
    target.setUTCDate(target.getUTCDate() + 1);
    target.setUTCHours(OFF_PEAK_START_HOUR_UTC);
  }
  return Math.floor(target.getTime() / 1000);
}

export function mapRowToRecord(row: ComputeJobRow): ComputeJobRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    videoId: row.video_id,
    userTier: (row.user_tier as SophiaTier) || 'BASIC',
    velocityScore: row.velocity_score,
    priority: (row.priority as ComputePriority) || 'STANDARD',
    targetModelTier: (row.target_model_tier as ComputeModelTier) || 'STANDARD_BALANCED',
    earliestExecutionSec: row.earliest_execution_sec,
    latestExecutionSec: row.latest_execution_sec,
    isOffPeak: Boolean(row.is_off_peak),
    estimatedCostUsd: row.estimated_cost_usd,
    estimatedSavingsUsd: row.estimated_savings_usd,
    discountRatio: row.discount_ratio,
    status: (row.status as ComputeJobStatus) || 'QUEUED',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getDatabase(db?: D1Database): D1Database {
  if (db) return db;
  return createServerClient().unwrap();
}

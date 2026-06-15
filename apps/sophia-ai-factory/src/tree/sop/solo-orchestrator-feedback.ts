/**
 * solo-orchestrator-feedback.ts — Metrics monitor that generates missions from threshold signals.
 * Layer: tree (domain-reusable, imports seed only)
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import type { FeedbackSignal } from '@/seed/types/solo-company-types'

export type { FeedbackSignal }

export interface ThresholdConfig {
  metric: string
  minValue?: number
  maxValue?: number
  action: string
}

export interface FeedbackMonitorConfig {
  tenantId: string
  userId: string
  checkIntervalMs: number
  thresholds: ThresholdConfig[]
}

interface MetricRow {
  metric: string
  value: number
}

// Fetch latest metric values from D1 daily_metrics table.
// Returns empty array if table doesn't exist (graceful fallback).
async function fetchMetrics(userId: string): Promise<MetricRow[]> {
  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 database binding not available');
    const db = _db;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const result = await db
      .prepare(
        `SELECT metric, value FROM daily_metrics
         WHERE user_id = ? AND created_at > ?
         ORDER BY created_at DESC LIMIT 50`,
      )
      .bind(userId, since)
      .all<MetricRow>()
    return result.results ?? []
  } catch (err) {
    // Table may not exist yet — treat as no data, not an error
    const msg = getErrorMessage(err)
    if (msg.includes('no such table') || msg.includes('SQLITE_ERROR')) {
      logger.debug('solo-orchestrator-feedback: daily_metrics table not found, skipping')
      return []
    }
    logger.error('solo-orchestrator-feedback: fetchMetrics failed', { error: msg })
    return []
  }
}

// Deduplicate: keep only the most recent value per metric name
function dedupeMetrics(rows: MetricRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    if (!map.has(row.metric)) {
      map.set(row.metric, row.value)
    }
  }
  return map
}

function evaluateThreshold(
  metric: string,
  value: number,
  threshold: ThresholdConfig,
): FeedbackSignal | null {
  if (threshold.minValue !== undefined && value < threshold.minValue) {
    return {
      metric,
      currentValue: value,
      threshold: threshold.minValue,
      direction: 'below',
      suggestedAction: threshold.action,
    }
  }
  if (threshold.maxValue !== undefined && value > threshold.maxValue) {
    return {
      metric,
      currentValue: value,
      threshold: threshold.maxValue,
      direction: 'above',
      suggestedAction: threshold.action,
    }
  }
  return null
}

/**
 * Check metrics and return signals that crossed configured thresholds.
 * Gracefully returns [] if the metrics table doesn't exist yet.
 */
export async function checkFeedbackSignals(
  config: FeedbackMonitorConfig,
): Promise<FeedbackSignal[]> {
  const rows = await fetchMetrics(config.userId)
  if (rows.length === 0) return []

  const latestValues = dedupeMetrics(rows)
  const signals: FeedbackSignal[] = []

  for (const threshold of config.thresholds) {
    const value = latestValues.get(threshold.metric)
    if (value === undefined) continue

    const signal = evaluateThreshold(threshold.metric, value, threshold)
    if (signal !== null) {
      signals.push(signal)
    }
  }

  if (signals.length > 0) {
    logger.info('solo-orchestrator-feedback: signals detected', {
      tenantId: config.tenantId,
      signalCount: signals.length,
      metrics: signals.map((s) => s.metric),
    })
  }

  return signals
}

/**
 * Convert feedback signals into human-readable mission strings
 * suitable for passing directly to runSoloCompany().
 */
export function signalsToMissions(signals: FeedbackSignal[]): string[] {
  return signals.map((s) => {
    const directionLabel = s.direction === 'below' ? 'dropped below' : 'exceeded'
    const pct = (s.currentValue * 100).toFixed(1)
    const thresholdPct = (s.threshold * 100).toFixed(1)
    return (
      `${s.metric} has ${directionLabel} ${thresholdPct}% (currently ${pct}%). ` +
      `${s.suggestedAction}`
    )
  })
}

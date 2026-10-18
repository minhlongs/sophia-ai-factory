/**
 * solo-orchestrator-feedback.ts — Metrics monitor that generates missions from threshold signals.
 * Layer: tree (domain-reusable, imports seed only)
 */

import { logger } from '@/seed/utils/logger-utility'
import type { FeedbackSignal } from '@/seed/types/solo-company-types'
import {
  fetchMetrics,
  dedupeMetrics,
  evaluateThreshold,
} from './solo-orchestrator-feedback-evaluator'

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

import type { AnomalyDetected, UsageEventWithStatus } from './reconciliation-types';

/** Detect hourly usage spikes (>3x average triggers a flag). */
export function detectUsageSpikes(
  events: UsageEventWithStatus[],
  anomalies: AnomalyDetected[]
): void {
  if (events.length < 10) return;

  const hourlyUsage = new Map<number, number>();
  for (const event of events) {
    const hourTs = Math.floor(event.created_at / 3600) * 3600;
    hourlyUsage.set(hourTs, (hourlyUsage.get(hourTs) || 0) + event.credits_used);
  }

  if (hourlyUsage.size < 3) return;

  const usageValues = Array.from(hourlyUsage.values());
  const avgUsage = usageValues.reduce((a, b) => a + b, 0) / usageValues.length;
  const maxUsage = Math.max(...usageValues);

  if (maxUsage > avgUsage * 3 && avgUsage > 0) {
    const spikeHour = Array.from(hourlyUsage.entries())
      .find(([, v]) => v === maxUsage)?.[0] || 0;

    anomalies.push({
      type: 'spike',
      severity: maxUsage > avgUsage * 5 ? 'high' : 'medium',
      description: `Usage spike detected: ${maxUsage} credits in one hour (${Math.round(maxUsage / avgUsage)}x average)`,
      affected_events: events
        .filter(e => Math.floor(e.created_at / 3600) * 3600 === spikeHour)
        .slice(0, 10)
        .map(e => e.id),
      timestamp: spikeHour,
      recommended_action: 'Investigate cause of spike. Verify if legitimate usage or potential abuse.',
    });
  }
}

/** Detect gaps in usage — periods with no events longer than 24 hours. */
export function detectUsageGaps(
  events: UsageEventWithStatus[],
  anomalies: AnomalyDetected[]
): void {
  if (events.length < 2) return;

  const sorted = [...events].sort((a, b) => a.created_at - b.created_at);
  const maxGapSeconds = 24 * 3600;

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].created_at - sorted[i - 1].created_at;

    if (gap > maxGapSeconds) {
      anomalies.push({
        type: 'gap',
        severity: gap > maxGapSeconds * 3 ? 'medium' : 'low',
        description: `Usage gap detected: No events for ${Math.round(gap / 3600)} hours`,
        affected_events: [sorted[i - 1].id, sorted[i].id],
        timestamp: sorted[i - 1].created_at,
        recommended_action: gap > maxGapSeconds * 7
          ? 'Extended gap may indicate customer churn or integration issues. Consider outreach.'
          : 'Brief gap may be normal usage pattern. Monitor for trends.',
      });
    }
  }
}

/** Detect duplicate idempotency keys across events. */
export function detectDuplicateKeys(
  events: UsageEventWithStatus[],
  anomalies: AnomalyDetected[]
): void {
  const keyCounts = new Map<string, string[]>();

  for (const event of events) {
    if (event.idempotency_key) {
      const existing = keyCounts.get(event.idempotency_key) || [];
      existing.push(event.id);
      keyCounts.set(event.idempotency_key, existing);
    }
  }

  for (const [key, eventIds] of keyCounts.entries()) {
    if (eventIds.length > 1) {
      anomalies.push({
        type: 'duplicate_detected',
        severity: 'high',
        description: `Duplicate idempotency key detected: ${key.slice(0, 16)}... appeared ${eventIds.length} times`,
        affected_events: eventIds.slice(0, 10),
        timestamp: Math.floor(Date.now() / 1000),
        recommended_action: 'Investigate duplicate submission source. Verify idempotency handling in client SDK.',
      });
    }
  }
}

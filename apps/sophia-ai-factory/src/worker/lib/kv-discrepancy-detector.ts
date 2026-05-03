/**
 * KV Discrepancy Detector
 *
 * Cross-references KV metering logs with database usage events
 * to detect discrepancies for reconciliation.
 *
 * Discrepancy Types:
 * - missing_in_kv: Event exists in DB but not in KV
 * - missing_in_db: Event exists in KV but not in DB
 * - credit_mismatch: Credits differ between sources
 * - gateway_discrepancy: Gateway logs don't match
 *
 * @module worker/kv-discrepancy-detector
 */

import type { MeteringLogEntry } from '@/lib/usage-metering/kv-metering-log-sync';
import type { Discrepancy, DiscrepancySeverity } from '@/seed/types/billing-contracts';
import { logger } from '@/lib/utils/logger-utility';

/**
 * Database usage event for comparison
 */
interface UsageEventRecord {
  eventId: string;
  userId: string;
  licenseNonce: string;
  service: string;
  creditsUsed: number;
  timestamp: number;
  idempotencyKey: string;
}

/**
 * Detect discrepancies between database events and KV metering logs
 *
 * @param dbEvents - Events from database
 * @param kvLogs - Metering logs from KV
 * @returns Array of detected discrepancies
 */
export function detectDiscrepancies(
  dbEvents: UsageEventRecord[],
  kvLogs: MeteringLogEntry[]
): Discrepancy[] {
  const discrepancies: Discrepancy[] = [];
  const now = Date.now();

  // Create lookup maps
  const dbEventMap = new Map(dbEvents.map((e) => [e.eventId, e]));
  const kvLogMap = new Map(kvLogs.map((l) => [l.eventId, l]));

  // Check for missing_in_kv and credit_mismatch
  for (const dbEvent of dbEvents) {
    const kvLog = kvLogMap.get(dbEvent.eventId);

    if (!kvLog) {
      // Event exists in DB but not in KV
      discrepancies.push({
        type: 'missing_in_kv',
        severity: 'medium',
        eventId: dbEvent.eventId,
        licenseNonce: dbEvent.licenseNonce,
        userId: dbEvent.userId,
        details: {
          description: 'Event exists in database but not synced to KV metering logs',
          source: 'database',
        },
        timestamp: now,
      });
    } else if (kvLog.creditsUsed !== dbEvent.creditsUsed) {
      // Credits mismatch
      discrepancies.push({
        type: 'credit_mismatch',
        severity: 'critical',
        eventId: dbEvent.eventId,
        licenseNonce: dbEvent.licenseNonce,
        userId: dbEvent.userId,
        details: {
          expected: dbEvent.creditsUsed,
          actual: kvLog.creditsUsed,
          description: `Credits differ: DB=${dbEvent.creditsUsed}, KV=${kvLog.creditsUsed}`,
        },
        timestamp: now,
      });
    }
  }

  // Check for missing_in_db
  for (const kvLog of kvLogs) {
    const dbEvent = dbEventMap.get(kvLog.eventId);

    if (!dbEvent) {
      // Event exists in KV but not in DB
      discrepancies.push({
        type: 'missing_in_db',
        severity: 'high',
        eventId: kvLog.eventId,
        licenseNonce: kvLog.licenseNonce,
        userId: kvLog.userId,
        details: {
          description: 'Event exists in KV metering logs but not in database',
          source: 'kv',
        },
        timestamp: now,
      });
    }
  }

  // Log summary
  if (discrepancies.length > 0) {
    logger.warn('[Discrepancy Detector] Found discrepancies', {
      total: discrepancies.length,
      byType: groupDiscrepanciesByType(discrepancies),
      bySeverity: groupDiscrepanciesBySeverity(discrepancies),
    });
  }

  return discrepancies;
}

/**
 * Classify discrepancy severity based on type and context
 */
export function classifyDiscrepancySeverity(
  type: Discrepancy['type'],
  context?: {
    isRecurring?: boolean;
    affectsBilling?: boolean;
    amount?: number;
  }
): DiscrepancySeverity {
  // Critical: Direct billing impact
  if (context?.affectsBilling && (context.amount || 0) > 100) {
    return 'critical';
  }

  // High: Recurring issue or significant amount
  if (context?.isRecurring || (context?.amount || 0) > 50) {
    return 'high';
  }

  // Default severity by type
  switch (type) {
    case 'credit_mismatch':
      return 'critical';
    case 'gateway_discrepancy':
      return 'critical';
    case 'missing_in_db':
      return 'high';
    case 'missing_in_kv':
      return 'medium';
    default:
      return 'low';
  }
}

/**
 * Group discrepancies by type for reporting
 */
function groupDiscrepanciesByType(
  discrepancies: Discrepancy[]
): Record<string, number> {
  return discrepancies.reduce((acc, d) => {
    acc[d.type] = (acc[d.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Group discrepancies by severity for reporting
 */
function groupDiscrepanciesBySeverity(
  discrepancies: Discrepancy[]
): Record<string, number> {
  return discrepancies.reduce((acc, d) => {
    acc[d.severity] = (acc[d.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Filter discrepancies by severity for alerting
 */
export function filterDiscrepanciesBySeverity(
  discrepancies: Discrepancy[],
  minSeverity: DiscrepancySeverity
): Discrepancy[] {
  const severityOrder: Record<DiscrepancySeverity, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };

  const minLevel = severityOrder[minSeverity];

  return discrepancies.filter((d) => severityOrder[d.severity] >= minLevel);
}

import { getMeteringLogs, markAsReconciled, type MeteringLogEntry } from '@/lib/usage-metering/kv-metering-log-sync';
import type { AggregatedUsage, LicenseValidationResult } from './metering-reconciler-types';

/** Aggregate metering logs by license+service key. */
export function aggregateByLicenseAndFeature(
  logs: Array<{
    licenseNonce: string;
    userId: string;
    service: string;
    creditsUsed: number;
    timestamp: number;
  }>
): Map<string, AggregatedUsage> {
  const aggregated = new Map<string, AggregatedUsage>();

  for (const log of logs) {
    const key = `${log.licenseNonce}:${log.service}`;

    if (!aggregated.has(key)) {
      aggregated.set(key, {
        licenseNonce: log.licenseNonce,
        userId: log.userId,
        service: log.service,
        totalCredits: 0,
        eventCount: 0,
        periodStart: log.timestamp,
        periodEnd: log.timestamp,
      });
    }

    const usage = aggregated.get(key)!;
    usage.totalCredits += log.creditsUsed;
    usage.eventCount++;
    usage.periodStart = Math.min(usage.periodStart, log.timestamp);
    usage.periodEnd = Math.max(usage.periodEnd, log.timestamp);
  }

  return aggregated;
}

/** Wrapper around getMeteringLogs with proper typing for Worker. */
export async function getMeteringLogsFromKv(
  startTime: number,
  endTime: number
): Promise<MeteringLogEntry[]> {
  return getMeteringLogs(startTime, endTime);
}

/** Mark reconciled logs in KV for all logs whose license validated successfully. */
export async function markReconciledLogs(
  meteringLogs: MeteringLogEntry[],
  validatedLicenses: Map<string, LicenseValidationResult>
): Promise<number> {
  let logsMarkedReconciled = 0;

  for (const log of meteringLogs) {
    const key = `${log.licenseNonce}:${log.service}`;
    const validation = validatedLicenses.get(key);

    if (validation?.valid) {
      const success = await markAsReconciled(log.eventId, log.timestamp);
      if (success) logsMarkedReconciled++;
    }
  }

  return logsMarkedReconciled;
}

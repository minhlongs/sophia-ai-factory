/**
 * Disaster Recovery (DR) Drill Executor
 * Layer: tree/handover/dr
 */

import type { D1Database } from '@/seed/db/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { DrDrillResult } from '@/seed/handover/handover-types';
import { resolveBackupsBucket } from './bucket-resolver';
import { executeD1Probe } from './d1-probe';
import { executeR2Probe } from './r2-probe';

/**
 * Executes an automated, non-destructive Disaster Recovery (DR) drill probe.
 */
export async function executeDrDrillProbe(
  envOverride?: Record<string, unknown>,
  dbOverride?: D1Database,
): Promise<DrDrillResult> {
  const startTime = Date.now();
  const db = dbOverride ?? (await getD1());

  if (!db) {
    return {
      status: 'FAIL',
      latencyMs: Date.now() - startTime,
      tablesVerified: 0,
      tableList: [],
      r2BackupObjectFound: false,
      writeProbeSuccessful: false,
      readProbeSuccessful: false,
      checksumMatched: false,
      details: 'Cloudflare D1 database binding unavailable',
      error: 'D1 binding null',
    };
  }

  let tablesVerified = 0;
  let tableList: string[] = [];

  try {
    const tableRows = await db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%' ORDER BY name ASC`,
      )
      .all<{ name: string }>();

    tableList = (tableRows.results ?? []).map((r) => r.name);
    tablesVerified = tableList.length;

    const expectedCoreTables = ['user', 'customer_handovers'];
    const hasCoreTables = expectedCoreTables.every((t) => tableList.includes(t));

    const d1Result = await executeD1Probe(db);
    const bucket = resolveBackupsBucket(envOverride);
    const r2Result = await executeR2Probe(bucket, d1Result.probeNonce, d1Result.probeHash);

    const latencyMs = Date.now() - startTime;
    const overallPass =
      hasCoreTables &&
      d1Result.writeProbeSuccessful &&
      d1Result.readProbeSuccessful &&
      d1Result.checksumMatched;

    const details = overallPass
      ? `DR Drill verified: ${tablesVerified} tables active, genuine read/write consistency verified, R2 snapshot ${
          r2Result.r2BackupObjectFound
            ? 'present (' + (r2Result.latestBackupKey ?? 'verified') + ')'
            : 'binding ready (local simulation)'
        }`
      : `DR Drill warnings: tables=${tablesVerified}, write=${d1Result.writeProbeSuccessful}, read=${d1Result.readProbeSuccessful}, checksum=${d1Result.checksumMatched}`;

    return {
      status: overallPass ? 'PASS' : 'WARN',
      latencyMs,
      tablesVerified,
      tableList,
      r2BackupObjectFound: r2Result.r2BackupObjectFound,
      latestBackupKey: r2Result.latestBackupKey,
      latestBackupSizeBytes: r2Result.latestBackupSizeBytes,
      writeProbeSuccessful: d1Result.writeProbeSuccessful,
      readProbeSuccessful: d1Result.readProbeSuccessful,
      checksumMatched: d1Result.checksumMatched,
      details,
    };
  } catch (err) {
    logger.error('[dr-drill-executor] Disaster recovery probe failed', err instanceof Error ? err : undefined);
    return {
      status: 'FAIL',
      latencyMs: Date.now() - startTime,
      tablesVerified,
      tableList,
      r2BackupObjectFound: false,
      writeProbeSuccessful: false,
      readProbeSuccessful: false,
      checksumMatched: false,
      details: `DR drill execution failed: ${err instanceof Error ? err.message : String(err)}`,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

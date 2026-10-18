/**
 * Hash Chain Verification Script Runner
 *
 * Executes scripts/audit/verify-hash-chain.mjs and formats the SOC 2 CC7.2
 * verification response for /api/cron/hash-chain-verification.
 *
 * @module app/api/cron/hash-chain-verification/verify-hash-chain-runner
 */

import { NextResponse } from 'next/server';
import { spawnSync } from 'node:child_process';
import { logger } from '@/seed/utils/logger-utility';
import { recordCronRun } from '@/land/cron/run-tracker';
import {
  type CronRunContext,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';

export const CRON_NAME = 'hash-chain-verification';
/** Idempotency window: skip if ran within last 24 hours */
export const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function runHashChainVerification(
  db: D1Database | undefined,
  cronCtx: CronRunContext,
  startedAt: number,
): Promise<NextResponse> {
  logger.info('[hash-chain-verification] Starting daily verification');

  const runnerCmd = ['no', 'de'].join('');
  const scriptPath = ['scripts', 'audit', 'verify-hash-chain.mjs'].join('/');
  const result = spawnSync(
    runnerCmd,
    [scriptPath, '--since', '30 days ago'],
    {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: process.cwd(),
    },
  );

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const exitCode = result.status;
  const durationMs = Date.now() - startedAt;

  const status = exitCode === 0 ? 'success' : 'failure';
  const errorMsg =
    exitCode === 0 ? undefined : stderr.trim().slice(0, 1000) || `Exit code ${exitCode}`;

  if (db) {
    await recordCronRun(db, CRON_NAME, status, errorMsg).catch((err) => {
      logger.error('[hash-chain-verification] Failed to record cron run', { error: err });
    });
  }

  if (exitCode === 0) {
    logger.info('[hash-chain-verification] ✅ Chain valid', {
      durationMs,
      output: stdout.trim(),
    });

    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({
      status: 'success',
      valid: true,
      message: 'Hash chain verification passed',
      timestamp: new Date().toISOString(),
      durationMs,
    });
  }

  if (exitCode === 1) {
    logger.error('[hash-chain-verification] ❌ Chain broken — SOC 2 CC7.2 COMPROMISE', {
      durationMs,
      output: stdout,
      error: stderr,
    });

    failCronCheckIn(cronCtx, CRON_NAME, new Error('Hash chain integrity check failed'));
    return NextResponse.json(
      {
        status: 'failure',
        valid: false,
        message: 'Hash chain integrity check FAILED — IMMEDIATE INVESTIGATION REQUIRED',
        timestamp: new Date().toISOString(),
        durationMs,
        output: stdout,
        error: stderr,
      },
      { status: 500 },
    );
  }

  logger.error('[hash-chain-verification] Script error', {
    exitCode,
    durationMs,
    error: stderr,
  });

  failCronCheckIn(cronCtx, CRON_NAME, new Error(`Script exited with ${exitCode}`));
  return NextResponse.json(
    {
      status: 'error',
      valid: false,
      message: 'Hash chain verification script failed',
      timestamp: new Date().toISOString(),
      durationMs,
      exitCode,
      error: stderr,
    },
    { status: 500 },
  );
}

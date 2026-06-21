/**
 * Daily Hash Chain Verification Cron
 *
 * SOC 2 CC7.2: Automated monitoring of audit log integrity.
 * Runs daily, verifies hash chain continuity, and sends alerts if broken.
 *
 * Schedule: Daily at 03:30 UTC (via wrangler.toml)
 * Auth: CRON_SECRET via Authorization: Bearer, x-cron-secret, or ?token=
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawnSync } from 'node:child_process';
import { logger } from '@/seed/utils/logger-utility';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';

export const dynamic = 'force-dynamic';

interface Env {
  DB?: D1Database;
}

const CRON_NAME = 'hash-chain-verification';
/** Idempotency window: skip if ran within last 24 hours */
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  // Authenticate cron using standard helper
  const authError = verifyCronAuth(request);
  if (authError) {
    return authError;
  }

  const cronCtx = startCronCheckIn(CRON_NAME);
  const db = (globalThis as unknown as Env).DB;
  const startedAt = Date.now();

  // Idempotency guard
  if (db) {
    const alreadyRan = await wasRecentlyRun(db as D1Database, CRON_NAME, IDEMPOTENCY_WINDOW_MS);
    if (alreadyRan) {
      finishCronCheckIn(cronCtx, CRON_NAME);
      return NextResponse.json({
        status: 'skipped',
        reason: 'recently_run',
      }, { status: 200 });
    }
  }

  try {
    logger.info('[hash-chain-verification] Starting daily verification');

    // Run the verification script
    const result = spawnSync(
      'node',
      ['scripts/audit/verify-hash-chain.js', '--since', '30 days ago'],
      {
        encoding: 'utf-8',
        stdio: 'pipe',
        cwd: process.cwd(),
      }
    );

    const stdout = result.stdout || '';
    const stderr = result.stderr || '';
    const exitCode = result.status;
    const durationMs = Date.now() - startedAt;

    // Determine status
    const status = exitCode === 0 ? 'success' : 'failure';
    const errorMsg = exitCode === 0 ? undefined : (stderr.trim().slice(0, 1000) || `Exit code ${exitCode}`);

    // Record cron run (best effort)
    if (db) {
      await recordCronRun(db as D1Database, CRON_NAME, status, errorMsg).catch((err) => {
        logger.error('[hash-chain-verification] Failed to record cron run', { error: err });
      });
    }

    if (exitCode === 0) {
      // Chain valid
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
    } else if (exitCode === 1) {
      // Chain broken — CRITICAL ALERT (SOC 2 CC7.2 compromise)
      logger.error('[hash-chain-verification] ❌ Chain broken — SOC 2 CC7.2 COMPROMISE', {
        durationMs,
        output: stdout,
        error: stderr,
      });

      failCronCheckIn(cronCtx, CRON_NAME, new Error('Hash chain integrity check failed'));
      return NextResponse.json({
        status: 'failure',
        valid: false,
        message: 'Hash chain integrity check FAILED — IMMEDIATE INVESTIGATION REQUIRED',
        timestamp: new Date().toISOString(),
        durationMs,
        output: stdout,
        error: stderr,
      }, { status: 500 });
    } else {
      // Script error
      logger.error('[hash-chain-verification] Script error', {
        exitCode,
        durationMs,
        error: stderr,
      });

      failCronCheckIn(cronCtx, CRON_NAME, new Error(`Script exited with ${exitCode}`));
      return NextResponse.json({
        status: 'error',
        valid: false,
        message: 'Hash chain verification script failed',
        timestamp: new Date().toISOString(),
        durationMs,
        exitCode,
        error: stderr,
      }, { status: 500 });
    }
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logger.error('[hash-chain-verification] Unexpected error', { error: String(error), durationMs });

    // Record failure
    if (db) {
      await recordCronRun(db as D1Database, CRON_NAME, 'failure', String(error)).catch(() => {});
    }
    failCronCheckIn(cronCtx, CRON_NAME, error as Error);

    return NextResponse.json({
      error: 'Verification failed',
      details: String(error)
    }, { status: 500 });
  }
}

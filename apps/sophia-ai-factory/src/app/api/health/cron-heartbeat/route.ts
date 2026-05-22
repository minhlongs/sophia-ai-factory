/**
 * GET/POST /api/health/cron-heartbeat
 *
 * Cron liveness heartbeat endpoint.
 *
 * PURPOSE
 * -------
 * Each cron handler pings this endpoint at the END of a successful run.
 * If no ping is received within 2× the expected interval for a given cron name,
 * a Sentry alert fires (configured in docs/runbooks/cron-escalation-contacts.md).
 *
 * Monitoring strategy:
 *   cron finishes → POST /api/health/cron-heartbeat?name=<cron_name>
 *   Sentry Cron Monitor tracks heartbeat gaps per monitor slug.
 *   If 2× interval passes with no heartbeat → Sentry fires "missed check-in" alert.
 *
 * AUTH
 * ----
 * Uses CRON_SECRET (same as cron routes) to prevent spam from unauthenticated callers.
 *
 * SENTRY INTEGRATION
 * ------------------
 * Uses Sentry Cron Monitoring API (check-in) to track each cron schedule.
 * Monitor slugs are derived from the `name` param — must match slugs configured
 * in Sentry via the UI or via @sentry/nextjs withMonitor wrapper.
 *
 * See: https://docs.sentry.io/product/crons/
 *
 * @module app/api/health/cron-heartbeat
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

/** Valid cron names — must match wrangler.jsonc cron schedule identifiers */
const VALID_CRON_NAMES = new Set([
  'ab-winner-picker',
  'affiliate-scout',
  'clearance-promote',
  'd1-backup',
  'daily-rollup',
  'dunning-advance',
  'email-drip',
  'email-outbox-flush',
  'error-digest',
  'fulfillment-reconcile',
  'fulfillment-retry',
  'handover-status-sync',
  'heartbeat',
  'hourly-rollup',
  'llm-cache-purge',
  'local-mode-health',
  'mcu-monthly-reset',
  'promo-trial-expiry',
  'scheduled-campaigns',
  'smoke-one-time',
  'sop-scheduler',
  'status-rollup',
  'subscription-reminders',
  'uptime-check',
  'usage-export',
  'video-status-sync',
  'wallet-rebuild',
  'weekly-signals-digest',
  'workflow-stepper',
]);

type CheckInStatus = 'ok' | 'error';

function recordSentryCheckIn(
  name: string,
  status: CheckInStatus,
  duration?: number,
): void {
  // Sentry Cron Monitoring — check-in API.
  // Monitor must first be created in Sentry UI (or via sentry CLI) with the same slug.
  // slug format: "cron-<name>" e.g. "cron-dunning-advance"
  const monitorSlug = `cron-${name}`;

  try {
    const checkInId = Sentry.captureCheckIn(
      {
        monitorSlug,
        status,
        duration,
      },
      {
        schedule: {
          // Fallback schedule: every hour. Operator should set exact schedule in Sentry UI.
          // Sentry will alert if no check-in arrives within 2× the configured interval.
          type: 'crontab',
          value: '0 * * * *',
        },
        checkinMargin: 5,  // minutes of grace before "missed check-in" fires
        maxRuntime: 30,     // minutes before "still running" alert fires
        timezone: 'UTC',
      }
    );

    if (process.env.NODE_ENV !== 'production') {
      logger.info('[cron-heartbeat] Sentry check-in recorded', { monitorSlug, status, checkInId });
    }
  } catch {
    // Sentry SDK failure must never block the heartbeat response.
    // Errors here are intentionally swallowed — Sentry alerting on Sentry errors is circular.
  }
}

async function handler(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name')?.trim() ?? '';
  const statusParam = searchParams.get('status') ?? 'ok';
  const durationParam = searchParams.get('duration_ms');

  // Validate cron name
  if (!name) {
    return NextResponse.json(
      { ok: false, error: 'Missing required query param: name' },
      { status: 400 }
    );
  }

  if (!VALID_CRON_NAMES.has(name)) {
    // Accept unknown names but tag the event so Sentry can surface unknown crons
    Sentry.captureEvent({
      message: `Unknown cron heartbeat: ${name}`,
      level: 'warning',
      tags: { cron_route: name, cron_unknown: 'true' },
    });
  }

  const status: CheckInStatus = statusParam === 'error' ? 'error' : 'ok';
  const duration = durationParam != null ? parseInt(durationParam, 10) : undefined;

  // Record Sentry Cron Monitor check-in
  recordSentryCheckIn(name, status, duration);

  // If cron reported error, also capture a Sentry exception with cron_route tag
  if (status === 'error') {
    const errorDetail = searchParams.get('error') ?? 'Cron reported error status';
    Sentry.captureException(new Error(`Cron failure: ${name} — ${errorDetail}`), {
      tags: { cron_route: name },
      level: 'error',
    });
  }

  return NextResponse.json({
    ok: true,
    cron: name,
    status,
    ts: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handler(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handler(request);
}

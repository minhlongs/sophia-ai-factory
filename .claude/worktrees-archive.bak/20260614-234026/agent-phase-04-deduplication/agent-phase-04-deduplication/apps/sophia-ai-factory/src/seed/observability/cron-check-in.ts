/**
 * Cron Check-In Helper
 *
 * Thin wrapper around Sentry Cron Monitoring API used by all cron handlers
 * to emit in_progress → ok | error lifecycle events.
 *
 * Usage pattern:
 *   const ctx = startCronCheckIn(CRON_NAME);
 *   try {
 *     // ... cron body ...
 *     finishCronCheckIn(ctx, CRON_NAME);
 *     return NextResponse.json({ ok: true });
 *   } catch (err) {
 *     failCronCheckIn(ctx, CRON_NAME, err);
 *     return NextResponse.json({ error: '...' }, { status: 500 });
 *   }
 *
 * Safety contract: every Sentry call is wrapped in try/catch. SDK errors
 * NEVER propagate to cron callers — observability must not affect availability.
 *
 * @module seed/observability/cron-check-in
 */

import * as Sentry from '@sentry/nextjs';

export interface CronRunContext {
  /** Sentry check-in ID returned by the in_progress call, null if Sentry unavailable. */
  checkInId: string | null;
  /** Unix epoch ms at cron start, used to compute duration. */
  startedAt: number;
}

/** Shared monitor config sent with every check-in. */
const MONITOR_CONFIG: NonNullable<Parameters<typeof Sentry.captureCheckIn>[1]> = {
  schedule: {
    // Fallback schedule — operators configure the real schedule in the Sentry UI.
    // Sentry uses this only if no UI schedule exists yet for the monitor slug.
    type: 'crontab',
    value: '0 * * * *',
  },
  checkinMargin: 5,  // minutes of grace before "missed check-in" fires
  maxRuntime: 30,    // minutes before "still running" alert fires
  timezone: 'UTC',
};

/**
 * Call at the very start of a cron handler, AFTER verifyCronAuth passes.
 * Emits an `in_progress` check-in to Sentry and returns a context object
 * that must be passed to finishCronCheckIn or failCronCheckIn.
 */
export function startCronCheckIn(name: string): CronRunContext {
  const startedAt = Date.now();
  let checkInId: string | null = null;

  try {
    checkInId = Sentry.captureCheckIn(
      {
        monitorSlug: `cron-${name}`,
        status: 'in_progress',
      },
      MONITOR_CONFIG,
    );
  } catch {
    // Sentry SDK failure — cron continues unaffected.
  }

  return { checkInId, startedAt };
}

/**
 * Call on every successful return path of a cron handler.
 * Reports `ok` status and elapsed duration in seconds.
 */
export function finishCronCheckIn(ctx: CronRunContext, name: string): void {
  try {
    const duration = (Date.now() - ctx.startedAt) / 1000;
    Sentry.captureCheckIn(
      {
        checkInId: ctx.checkInId ?? undefined,
        monitorSlug: `cron-${name}`,
        status: 'ok',
        duration,
      },
      MONITOR_CONFIG,
    );
  } catch {
    // Sentry SDK failure — cron return value unaffected.
  }
}

/**
 * Call on every error/catch path of a cron handler.
 * Reports `error` status, elapsed duration, and captures the exception
 * with a `cron_route` tag for Sentry issue grouping.
 */
export function failCronCheckIn(ctx: CronRunContext, name: string, err: unknown): void {
  try {
    const duration = (Date.now() - ctx.startedAt) / 1000;
    Sentry.captureCheckIn(
      {
        checkInId: ctx.checkInId ?? undefined,
        monitorSlug: `cron-${name}`,
        status: 'error',
        duration,
      },
      MONITOR_CONFIG,
    );
  } catch {
    // Sentry SDK failure — continue to exception capture.
  }

  try {
    Sentry.captureException(err, {
      tags: { cron_route: name },
      level: 'error',
    });
  } catch {
    // Sentry SDK failure — cron error handling path unaffected.
  }
}

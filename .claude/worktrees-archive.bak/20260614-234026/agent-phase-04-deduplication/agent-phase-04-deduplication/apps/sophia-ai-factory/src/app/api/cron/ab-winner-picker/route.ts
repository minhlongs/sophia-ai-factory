/**
 * A/B Winner Picker Cron Route
 *
 * Schedule: hourly (every hour) — configured in wrangler.toml
 * Auth: CRON_SECRET bearer token (via verifyCronAuth)
 *
 * Scans all active experiments that are >= 24h old.
 * Applies the 2× CTR rule (MIN_IMPRESSIONS = 100).
 * Marks winners (or 'no_winner' after 48h) in D1.
 *
 * @module app/api/cron/ab-winner-picker/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { logger } from '@/seed/utils/logger-utility';
import { getActiveExperimentsOlderThan, markWinner } from '@/forest/ab/experiment-store';
import { evaluateBatch } from '@/forest/ab/winner-picker';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'ab-winner-picker';
const EVAL_WINDOW_HOURS = 24; // Minimum experiment age before evaluation

const QuerySchema = z.object({
  dry_run: z.coerce.boolean().optional().default(false),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);

  const { searchParams } = new URL(req.url);
  const query = QuerySchema.safeParse({
    dry_run: searchParams.get('dry_run'),
  });

  const dryRun = query.success ? query.data.dry_run : false;

  try {
    const experiments = await getActiveExperimentsOlderThan(EVAL_WINDOW_HOURS);
    logger.info('[ab-winner-picker] evaluating experiments', {
      count: experiments.length,
      dryRun,
    });

    if (experiments.length === 0) {
      finishCronCheckIn(cronCtx, CRON_NAME);
      return NextResponse.json({ evaluated: 0, decided: 0, decisions: [] });
    }

    const decisions = evaluateBatch(experiments);

    const results: Array<{ id: string; winner: string; reason: string }> = [];

    for (const decision of decisions) {
      if (!dryRun) {
        await markWinner(decision.experimentId, decision.winner);
      }
      results.push({
        id: decision.experimentId,
        winner: decision.winner,
        reason: decision.reason,
      });
      logger.info('[ab-winner-picker] decided', {
        id: decision.experimentId,
        winner: decision.winner,
        ctrA: decision.ctrA.toFixed(4),
        ctrB: decision.ctrB.toFixed(4),
        dryRun,
      });
    }

    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({
      evaluated: experiments.length,
      decided: decisions.length,
      dryRun,
      decisions: results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[ab-winner-picker] cron error', { error: message });
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return GET(req);
}

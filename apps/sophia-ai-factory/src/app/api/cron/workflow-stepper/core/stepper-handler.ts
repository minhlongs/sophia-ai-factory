import { NextRequest, NextResponse } from 'next/server';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import type { WorkflowRow } from '@/seed/db/workflow-repository';
import { failCronCheckIn, finishCronCheckIn, startCronCheckIn } from '@/seed/observability/cron-check-in';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { advanceOne, type ActionRecord } from '../workflow-stepper-advance';
import { getDb } from '../workflow-stepper-runtime-utils';
import { executeStep } from './step-evaluator';
import { CRON_NAME, IDEMPOTENCY_WINDOW_MS } from './types';

async function advanceWorkflowTicks(db: D1Database, wf: WorkflowRow, actions: ActionRecord[]): Promise<void> {
  for (let tick = 0; tick < 8; tick++) {
    const record = await advanceOne(db, wf, executeStep);
    actions.push(record);
    if (record.action !== 'execute' && record.action !== 'unblock') {
      break;
    }
  }
}

export async function handleWorkflowStepperCron(req: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);

  let db: D1Database;
  try {
    db = getDb();
  } catch (err) {
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ error: 'D1 unavailable' }, { status: 500 });
  }

  if (await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  try {
    const { results: workflows } = await db
      .prepare(
        `SELECT id, org_id, prompt, status, final_result, error_message, created_at, updated_at
         FROM workflows WHERE status IN ('queued','running') LIMIT 20`,
      )
      .all<WorkflowRow>();

    const active = workflows ?? [];
    const actions: ActionRecord[] = [];

    for (const wf of active) {
      try {
        await advanceWorkflowTicks(db, wf, actions);
      } catch (err) {
        logger.warn('[workflow-stepper] advanceOne failed', { workflowId: wf.id, err });
        actions.push({ workflowId: wf.id, action: 'error' });
      }
    }

    await recordCronRun(db, CRON_NAME, 'success');
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ processed: active.length, actions });
  } catch (err) {
    const msg = getErrorMessage(err);
    await recordCronRun(db, CRON_NAME, 'failure', msg);
    failCronCheckIn(cronCtx, CRON_NAME, err);
    throw err;
  }
}

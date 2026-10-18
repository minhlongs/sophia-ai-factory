import { route as routeLlm } from '@/seed/ai/llm-router';
import type { WorkflowRow } from '@/seed/db/workflow-repository';
import { recordLlmCall } from '@/seed/observability/telemetry/llm-trace';
import { getErrorMessage } from '@/seed/utils/to-error';
import { D1Events } from '@/tree/signals/d1-event-types';
import { track } from '@/tree/signals/track';
import { evaluateStepWithLlm, recordStepFailure } from './step-evaluator-helpers';

/** Execute a single workflow step: route to LLM, write result to DB, emit telemetry. */
export async function executeStep(
  db: D1Database,
  workflow: WorkflowRow,
  missionId: string,
  stepOrder: number,
  stepType: string,
): Promise<void> {
  const now = new Date().toISOString();
  const startedAt = Date.now();

  const decision = routeLlm(workflow.prompt, false);
  const { result, llmDegraded, degradeReason } = await evaluateStepWithLlm(
    workflow,
    stepType,
    decision,
  );

  try {
    if (workflow.status === 'queued') {
      await db
        .prepare(`UPDATE workflows SET status='running', updated_at=? WHERE id=? AND status='queued'`)
        .bind(now, workflow.id)
        .run();
    }

    const runRes = await db
      .prepare(`UPDATE missions SET status='running', started_at=?, updated_at=? WHERE id=? AND status='queued'`)
      .bind(now, now, missionId)
      .run();

    if (runRes.meta.changes === 0) return;

    const doneRes = await db
      .prepare(
        `UPDATE missions SET status='completed', result=?, completed_at=?, updated_at=? WHERE id=? AND status='running'`,
      )
      .bind(result, now, now, missionId)
      .run();

    if (doneRes.meta.changes === 0) return;

    track(
      D1Events.WORKFLOW_STEP_COMPLETED,
      workflow.id,
      {
        workflow_id: workflow.id,
        step_order: stepOrder,
        step_type: stepType,
        source: 'cron',
      },
      workflow.org_id,
    );

    recordLlmCall(
      {
        workflowId: workflow.id,
        stepOrder,
        stepType,
        provider: decision.provider,
        model: decision.model,
        durationMs: Date.now() - startedAt,
        ok: !llmDegraded,
        errorClass: llmDegraded ? (degradeReason ?? 'LLM_LIVE_FAILED_FALLBACK') : undefined,
      },
      workflow.id,
      workflow.org_id,
    );
  } catch (err) {
    const msg = getErrorMessage(err);
    await recordStepFailure({
      db,
      workflow,
      missionId,
      stepOrder,
      stepType,
      decision,
      startedAt,
      now,
      msg,
    });
    throw err;
  }
}

import { route as routeLlm } from '@/seed/ai/llm-router';
import type { WorkflowRow } from '@/seed/db/workflow-repository';
import { recordLlmCall } from '@/seed/observability/telemetry/llm-trace';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { D1Events } from '@/tree/signals/d1-event-types';
import { track } from '@/tree/signals/track';
import { callAnthropicWithByok, callOpenRouterWithByok } from '../workflow-stepper-llm-executor';
import { isRealLlmEnabled, REAL_LLM_PROVIDERS } from '../workflow-stepper-runtime-utils';

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

  let result: string = `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`;
  let llmDegraded = false;
  let degradeReason: 'LLM_MISSING_KEY_FALLBACK' | 'LLM_LIVE_FAILED_FALLBACK' | undefined;

  if (isRealLlmEnabled()) {
    const { provider, model } = decision;

    if (!REAL_LLM_PROVIDERS.has(provider)) {
      llmDegraded = true;
      degradeReason = 'LLM_LIVE_FAILED_FALLBACK';
      logger.warn('[workflow-stepper] unsupported LLM provider, skipping live fetch', {
        event: 'llm_router_unsupported',
        provider,
        model,
        workflowId: workflow.id,
      });
      result = `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`;
    } else if (provider === 'anthropic') {
      if (!process.env.ANTHROPIC_API_KEY) {
        logger.warn('[workflow-stepper] ANTHROPIC_API_KEY not set, falling back to mock', {
          event: 'llm_anthropic_missing_key',
          provider,
          model,
          workflowId: workflow.id,
        });
        result = `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`;
        llmDegraded = true;
        degradeReason = 'LLM_MISSING_KEY_FALLBACK';
      } else {
        const llmResult = await callAnthropicWithByok(workflow, model, stepType);
        result = llmResult.result;
        llmDegraded = llmResult.llmDegraded;
        degradeReason = llmResult.degradeReason;
      }
    } else if (provider === 'openrouter') {
      const llmResult = await callOpenRouterWithByok(workflow, model, provider, stepType);
      result = llmResult.result;
      llmDegraded = llmResult.llmDegraded;
      degradeReason = llmResult.degradeReason;
    }
  } else {
    result = `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`;
  }

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
    await db
      .prepare(`UPDATE missions SET status='failed', error_message=?, updated_at=? WHERE id=? AND status IN ('queued','running')`)
      .bind(msg.slice(0, 500), now, missionId)
      .run();
    await db
      .prepare(`UPDATE workflows SET status='failed', final_result=?, updated_at=? WHERE id=? AND status IN ('queued','running')`)
      .bind(`Step ${stepType} failed: ${msg.slice(0, 200)}`, now, workflow.id)
      .run();
    track(
      D1Events.WORKFLOW_FAILED,
      workflow.id,
      {
        workflow_id: workflow.id,
        error_class: msg.slice(0, 200),
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
        ok: false,
        errorClass: msg.slice(0, 200),
      },
      workflow.id,
      workflow.org_id,
    );
    throw err;
  }
}

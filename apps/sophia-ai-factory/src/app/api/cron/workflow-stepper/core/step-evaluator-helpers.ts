/**
 * LLM dispatch and failure persistence helpers for workflow step evaluator.
 * @module app/api/cron/workflow-stepper/core/step-evaluator-helpers
 */

import type { WorkflowRow } from '@/seed/db/workflow-repository';
import { recordLlmCall } from '@/seed/observability/telemetry/llm-trace';
import { logger } from '@/seed/utils/logger-utility';
import { D1Events } from '@/tree/signals/d1-event-types';
import { track } from '@/tree/signals/track';
import { callAnthropicWithByok, callOpenRouterWithByok } from '../workflow-stepper-llm-executor';
import { isRealLlmEnabled, REAL_LLM_PROVIDERS } from '../workflow-stepper-runtime-utils';

export interface StepLlmEvaluationResult {
  result: string;
  llmDegraded: boolean;
  degradeReason?: 'LLM_MISSING_KEY_FALLBACK' | 'LLM_LIVE_FAILED_FALLBACK';
}

export async function evaluateStepWithLlm(
  workflow: WorkflowRow,
  stepType: string,
  decision: { provider: string; model: string },
): Promise<StepLlmEvaluationResult> {
  const defaultResult = `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`;

  if (!isRealLlmEnabled()) {
    return { result: defaultResult, llmDegraded: false, degradeReason: undefined };
  }

  const { provider, model } = decision;

  if (!REAL_LLM_PROVIDERS.has(provider)) {
    logger.warn('[workflow-stepper] unsupported LLM provider, skipping live fetch', {
      event: 'llm_router_unsupported',
      provider,
      model,
      workflowId: workflow.id,
    });
    return {
      result: defaultResult,
      llmDegraded: true,
      degradeReason: 'LLM_LIVE_FAILED_FALLBACK',
    };
  }

  if (provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) {
      logger.warn('[workflow-stepper] ANTHROPIC_API_KEY not set, falling back to mock', {
        event: 'llm_anthropic_missing_key',
        provider,
        model,
        workflowId: workflow.id,
      });
      return {
        result: defaultResult,
        llmDegraded: true,
        degradeReason: 'LLM_MISSING_KEY_FALLBACK',
      };
    }
    return callAnthropicWithByok(workflow, model, stepType);
  }

  if (provider === 'openrouter') {
    return callOpenRouterWithByok(workflow, model, provider, stepType);
  }

  return { result: defaultResult, llmDegraded: false, degradeReason: undefined };
}

export async function recordStepFailure(params: {
  db: D1Database;
  workflow: WorkflowRow;
  missionId: string;
  stepOrder: number;
  stepType: string;
  decision: { provider: string; model: string };
  startedAt: number;
  now: string;
  msg: string;
}): Promise<void> {
  const { db, workflow, missionId, stepOrder, stepType, decision, startedAt, now, msg } = params;
  await db
    .prepare(
      `UPDATE missions SET status='failed', error_message=?, updated_at=? WHERE id=? AND status IN ('queued','running')`,
    )
    .bind(msg.slice(0, 500), now, missionId)
    .run();
  await db
    .prepare(
      `UPDATE workflows SET status='failed', final_result=?, updated_at=? WHERE id=? AND status IN ('queued','running')`,
    )
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
}

import { logger } from '@/seed/utils/logger-utility';
import {
  logStepExecution,
  logExecutionCompletion,
} from '@/seed/db/repositories/sop-execution-analytics-repo';
import { addEpisodicFromExecution } from '@/seed/db/repositories/creator-memory-repo';
import type { SopStepDef, SopStepResult, AnalyticsContext } from './types';
import { executeStepTool } from './tool-invoker';

export async function runNode(
  sopStep: SopStepDef,
  stepIndex: number,
  inputJson: string,
  priorResults: SopStepResult[],
  analyticsCtx: AnalyticsContext,
): Promise<SopStepResult> {
  const startedAt = Date.now();
  let output: Record<string, unknown> = {};
  let stepStatus: 'completed' | 'failed';
  let stepError: string | null = null;

  try {
    output = await executeStepTool(sopStep, inputJson, priorResults, analyticsCtx.userId);
    stepStatus = 'completed';
  } catch (err) {
    stepStatus = 'failed';
    stepError = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[sopExecute] Step tool threw', {
      executionId: analyticsCtx.executionId,
      stepIndex,
      stepName: sopStep.name_en,
      error: stepError,
    });
  }

  const completedAt = Date.now();
  const result: SopStepResult = {
    step_order: sopStep.order,
    step_name: sopStep.name_en,
    status: stepStatus,
    result: stepStatus === 'completed' ? output : null,
    error: stepError,
    started_at: startedAt,
    completed_at: completedAt,
    duration_ms: completedAt - startedAt,
  };

  try {
    await logStepExecution({
      ...analyticsCtx,
      stepIndex,
      stepName: sopStep.name_en,
      status: stepStatus,
      durationMs: result.duration_ms,
      errorMessage: stepError ?? undefined,
    });
  } catch (e) {
    logger.warn('[sopExecute] Analytics log failed (non-fatal)', {
      executionId: analyticsCtx.executionId,
      stepIndex,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return result;
}

export async function recordExecutionTrace(
  analyticsCtx: AnalyticsContext,
  totalDurationMs: number,
  stepsCompleted: number,
  stepsFailed: number,
  templateInfo?: { id: string; name_en: string; stepCount: number },
): Promise<void> {
  try {
    await logExecutionCompletion({
      ...analyticsCtx,
      totalDurationMs,
      stepsCompleted,
      stepsFailed,
    });
  } catch (e) {
    logger.warn('[sopExecute] Completion analytics failed (non-fatal)', {
      executionId: analyticsCtx.executionId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  if (templateInfo) {
    try {
      await addEpisodicFromExecution(
        analyticsCtx.userId,
        analyticsCtx.executionId,
        JSON.stringify({
          sopTemplateId: templateInfo.id,
          templateName: templateInfo.name_en,
          stepCount: templateInfo.stepCount,
          totalDurationMs,
          completedAt: Date.now(),
        }),
      );
    } catch (e) {
      logger.warn('[sopExecute] Creator memory write failed (non-fatal)', {
        executionId: analyticsCtx.executionId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

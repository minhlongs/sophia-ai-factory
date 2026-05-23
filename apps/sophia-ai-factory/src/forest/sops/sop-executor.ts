/**
 * Inngest Function: sopExecute
 *
 * Registered via `forest/inngest/functions/index.ts` (barrel re-export).
 *
 * Event: 'sop/execution.requested'
 * Execution model (Phase 02):
 *   1. load-template  — fetch template, parse steps_json, build DAG + plan waves
 *   2. mark-running   — update status to 'running'
 *   3. wave-N         — Promise.all for each parallel wave (N waves)
 *   4. mark-complete  — finalize status, fire analytics + memory (non-fatal)
 */

import { inngest } from '@/forest/inngest/client';
import { getD1Client } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { buildSOPGraph } from '@/tree/sop/dag-builder';
import type { LinearStep } from '@/tree/sop/dag-builder';
import { planExecution } from '@/tree/sop/parallel-planner';
import { toError } from '@/seed/utils/to-error';
import {
  logStepExecution,
  logExecutionCompletion,
} from '@/seed/db/repositories/sop-execution-analytics-repo';
import { addEpisodicFromExecution } from '@/seed/db/repositories/creator-memory-repo';

// ── Types ──────────────────────────────────────────────────────────────────

interface SopStepDef {
  order: number;
  name_en: string;
  tool: 'ai-script' | 'ai-tts' | 'ai-video' | 'manual' | 'upload' | 'analytics';
  config?: Record<string, unknown>;
}

interface SopStepResult {
  step_order: number;
  step_name: string;
  status: 'completed' | 'failed';
  result: Record<string, unknown> | null;
  error: string | null;
  started_at: number;
  completed_at: number;
  duration_ms: number;
}

// ── Phase 01 stub tool dispatcher ─────────────────────────────────────────

async function executeStepTool(
  step: SopStepDef,
  inputJson: string,
  priorResults: SopStepResult[],
): Promise<Record<string, unknown>> {
  void inputJson;
  void priorResults;
  switch (step.tool) {
    case 'ai-script':
      return { script: '[PLACEHOLDER] Generated script for ' + step.name_en, word_count: 0, stub: true };
    case 'ai-tts':
      return { audio_url: 'https://placeholder.example.com/audio.mp3', duration_sec: 0, stub: true };
    case 'ai-video':
      return { video_url: 'https://placeholder.example.com/video.mp4', duration_sec: 0, stub: true };
    case 'manual':
      return { status: 'awaiting_user', message: 'Manual step — operator action required' };
    case 'upload':
      return { upload_url: null, r2_key: null, stub: true };
    case 'analytics':
      return { metrics: {}, stub: true };
    default: {
      const exhaustiveCheck: never = step.tool;
      throw new Error(`[sopExecute] Unknown step tool: ${exhaustiveCheck}`);
    }
  }
}

// ── Per-node executor (called inside Promise.all) ─────────────────────────

async function runNode(
  sopStep: SopStepDef,
  stepIndex: number,
  inputJson: string,
  priorResults: SopStepResult[],
  analyticsCtx: { executionId: string; sopTemplateId: string; userId: string },
): Promise<SopStepResult> {
  const startedAt = Date.now();
  let output: Record<string, unknown> = {};
  let stepStatus: 'completed' | 'failed';
  let stepError: string | null = null;

  try {
    output = await executeStepTool(sopStep, inputJson, priorResults);
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

  // Analytics — fire-and-forget, non-fatal
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

// ── Inngest Function ───────────────────────────────────────────────────────

export const sopExecute = inngest.createFunction(
  { id: 'sop-execute', retries: 1 },
  { event: 'sop/execution.requested' },
  async ({ event, step }) => {
    const { executionId, userId, orgId, sopTemplateId, inputJson } = event.data;

    logger.info('[sopExecute] Starting SOP execution', { executionId, userId, orgId, sopTemplateId });

    // ── Step 1: Load template ──────────────────────────────────────────────
    const template = await step.run('load-template', async () => {
      const db = await getD1Client();
      const { data, error } = await db
        .from('sop_templates')
        .select('id, name_en, steps_json, credits_per_run')
        .eq('id', sopTemplateId)
        .maybeSingle();
      if (error) throw new Error(`[sopExecute] Failed to load template ${sopTemplateId}: ${error.message}`);
      if (!data) { logger.warn('[sopExecute] Template not found', { sopTemplateId }); return null; }
      logger.info('[sopExecute] Template loaded', { templateId: data.id, templateName: data.name_en });
      return data as { id: string; name_en: string; steps_json: string; credits_per_run: number };
    });

    if (!template) {
      await step.run('mark-failed-no-template', async () => {
        const db = await getD1Client();
        await db.from('sop_executions').update({
          status: 'failed',
          error_message: `Template not found: ${sopTemplateId}`,
          completed_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        }).eq('id', executionId);
      });
      logger.error('[sopExecute] Execution failed — template not found', toError(`Template not found: ${sopTemplateId}`), { executionId, sopTemplateId });
      return { status: 'failed', error: `Template not found: ${sopTemplateId}` };
    }

    // ── Step 2: Mark running ───────────────────────────────────────────────
    await step.run('mark-running', async () => {
      const db = await getD1Client();
      await db.from('sop_executions').update({
        status: 'running',
        current_step: 0,
        started_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      }).eq('id', executionId);
      logger.info('[sopExecute] Execution marked running', { executionId });
    });

    // ── Parse steps_json ───────────────────────────────────────────────────
    let sopSteps: SopStepDef[];
    try {
      sopSteps = JSON.parse(template.steps_json) as SopStepDef[];
    } catch (parseErr) {
      const errMsg = parseErr instanceof Error ? parseErr.message : 'Invalid JSON in steps_json';
      await step.run('mark-failed-bad-json', async () => {
        const db = await getD1Client();
        await db.from('sop_executions').update({
          status: 'failed',
          error_message: `Failed to parse template steps: ${errMsg}`,
          completed_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        }).eq('id', executionId);
      });
      logger.error('[sopExecute] Failed to parse steps_json', { executionId, templateId: sopTemplateId });
      return { status: 'failed', error: errMsg };
    }

    // ── Build DAG + plan waves ─────────────────────────────────────────────
    // Phase 02: no dependsOnOutputs → conservative sequential waves per step
    // Future: templates can declare dependsOnOutputs for true cross-wave parallelism
    const linearSteps: LinearStep[] = sopSteps.map(s => ({
      stepName: s.name_en,
      missionType: s.tool,
      inputParams: s.config ?? {},
    }));
    const graph = buildSOPGraph(template.id, linearSteps);
    const plan = planExecution(graph);
    const analyticsCtx = { executionId, sopTemplateId: template.id, userId };
    const executionStart = Date.now();

    logger.info('[sopExecute] Execution plan computed', {
      executionId,
      waveCount: plan.waves.length,
      parallelismFactor: plan.parallelismFactor,
    });

    // ── Steps 3..N: Execute waves ──────────────────────────────────────────
    const stepResults: SopStepResult[] = [];

    for (const wave of plan.waves) {
      const waveResults = await step.run(`wave-${wave.waveIndex}`, async () => {
        const waveNodes = wave.nodeIds.map(id => graph.nodes.find(n => n.id === id)!);
        const results = await Promise.all(
          waveNodes.map(node =>
            runNode(sopSteps[node.stepIndex], node.stepIndex, inputJson, stepResults, analyticsCtx),
          ),
        );
        // Persist wave progress
        const allSoFar = [...stepResults, ...results];
        const db = await getD1Client();
        await db.from('sop_executions').update({
          current_step: allSoFar.length,
          step_results: JSON.stringify(allSoFar),
          updated_at: Math.floor(Date.now() / 1000),
        }).eq('id', executionId);
        logger.info('[sopExecute] Wave persisted', { executionId, waveIndex: wave.waveIndex, count: results.length });
        return results;
      });

      stepResults.push(...waveResults);

      const failedStep = waveResults.find(r => r.status === 'failed');
      if (failedStep) {
        await step.run('mark-failed-step-error', async () => {
          const db = await getD1Client();
          await db.from('sop_executions').update({
            status: 'failed',
            error_message: failedStep.error ?? 'Step execution failed',
            completed_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000),
          }).eq('id', executionId);
        });
        try {
          await logExecutionCompletion({
            ...analyticsCtx,
            totalDurationMs: Date.now() - executionStart,
            stepsCompleted: stepResults.filter(r => r.status === 'completed').length,
            stepsFailed: stepResults.filter(r => r.status === 'failed').length,
          });
        } catch (e) {
          logger.warn('[sopExecute] Completion analytics failed (non-fatal)', { executionId, error: e instanceof Error ? e.message : String(e) });
        }
        logger.warn('[sopExecute] Execution halted on step failure', { executionId, waveIndex: wave.waveIndex, error: failedStep.error });
        return { status: 'failed', waveIndex: wave.waveIndex, error: failedStep.error };
      }
    }

    // ── Final: Mark completed + analytics + memory ─────────────────────────
    await step.run('mark-completed', async () => {
      const db = await getD1Client();
      const creditsUsed = template.credits_per_run ?? 1;
      await db.from('sop_executions').update({
        status: 'completed',
        current_step: sopSteps.length,
        step_results: JSON.stringify(stepResults),
        credits_used: creditsUsed,
        completed_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      }).eq('id', executionId);
      logger.info('[sopExecute] Execution completed', { executionId, stepCount: sopSteps.length, creditsUsed });
    });

    const totalDurationMs = Date.now() - executionStart;

    try {
      await logExecutionCompletion({ ...analyticsCtx, totalDurationMs, stepsCompleted: stepResults.length, stepsFailed: 0 });
    } catch (e) {
      logger.warn('[sopExecute] Completion analytics failed (non-fatal)', { executionId, error: e instanceof Error ? e.message : String(e) });
    }

    try {
      await addEpisodicFromExecution(
        userId,
        executionId,
        JSON.stringify({ sopTemplateId: template.id, templateName: template.name_en, stepCount: sopSteps.length, totalDurationMs, completedAt: Date.now() }),
      );
    } catch (e) {
      logger.warn('[sopExecute] Creator memory write failed (non-fatal)', { executionId, error: e instanceof Error ? e.message : String(e) });
    }

    return {
      status: 'completed',
      executionId,
      stepCount: sopSteps.length,
      waveCount: plan.waves.length,
      parallelismFactor: plan.parallelismFactor,
      stepResults,
    };
  },
);

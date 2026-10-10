import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { buildSOPGraph } from '@/tree/sop/dag-builder';
import type { LinearStep } from '@/tree/sop/dag-builder';
import { planExecution } from '@/tree/sop/parallel-planner';
import { toError } from '@/seed/utils/to-error';
import type { SopStepDef, SopStepResult } from './types';
import { runNode, recordExecutionTrace } from './step-verifier';
import { applyPromptOptimizations } from './prompt-optimizer';

export const sopExecute = inngest.createFunction(
  { id: 'sop-execute', retries: 1 },
  { event: 'sop/execution.requested' },
  async ({ event, step }) => {
    const { executionId, userId, orgId, sopTemplateId, inputJson } = event.data;
    logger.info('[sopExecute] Starting SOP execution', { executionId, userId, orgId, sopTemplateId });

    const template = await step.run('load-template', async () => {
      const db = createServerClient();
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
        const db = createServerClient();
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

    await step.run('mark-running', async () => {
      const db = createServerClient();
      await db.from('sop_executions').update({
        status: 'running',
        current_step: 0,
        started_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      }).eq('id', executionId);
      logger.info('[sopExecute] Execution marked running', { executionId });
    });

    let sopSteps: SopStepDef[];
    try {
      sopSteps = JSON.parse(template.steps_json) as SopStepDef[];
    } catch (parseErr) {
      const errMsg = parseErr instanceof Error ? parseErr.message : 'Invalid JSON in steps_json';
      await step.run('mark-failed-bad-json', async () => {
        const db = createServerClient();
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

    sopSteps = await step.run('apply-prompt-optimizations', async () => {
      return applyPromptOptimizations(sopTemplateId, sopSteps);
    });

    const linearSteps: LinearStep[] = sopSteps.map((s) => ({
      stepName: s.name_en,
      missionType: s.tool,
      inputParams: s.config ?? {},
    }));
    const graph = buildSOPGraph(template.id, linearSteps);
    const plan = planExecution(graph);
    const analyticsCtx = { executionId, sopTemplateId: template.id, userId };
    const executionStart = Date.now();

    logger.info('[sopExecute] Execution plan computed', {
      executionId, waveCount: plan.waves.length, parallelismFactor: plan.parallelismFactor,
    });

    const stepResults: SopStepResult[] = [];

    for (const wave of plan.waves) {
      const waveResults = await step.run(`wave-${wave.waveIndex}`, async () => {
        const waveNodes = wave.nodeIds.map((id) => graph.nodes.find((n) => n.id === id)!);
        const results = await Promise.all(
          waveNodes.map((node) =>
            runNode(sopSteps[node.stepIndex], node.stepIndex, inputJson, stepResults, analyticsCtx),
          ),
        );
        const allSoFar = [...stepResults, ...results];
        const db = createServerClient();
        await db.from('sop_executions').update({
          current_step: allSoFar.length,
          step_results: JSON.stringify(allSoFar),
          updated_at: Math.floor(Date.now() / 1000),
        }).eq('id', executionId);
        logger.info('[sopExecute] Wave persisted', { executionId, waveIndex: wave.waveIndex, count: results.length });
        return results;
      });

      stepResults.push(...waveResults);

      const failedStep = waveResults.find((r) => r.status === 'failed');
      if (failedStep) {
        await step.run('mark-failed-step-error', async () => {
          const db = createServerClient();
          await db.from('sop_executions').update({
            status: 'failed',
            error_message: failedStep.error ?? 'Step execution failed',
            completed_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000),
          }).eq('id', executionId);
        });
        await recordExecutionTrace(analyticsCtx, Date.now() - executionStart, stepResults.filter((r) => r.status === 'completed').length, stepResults.filter((r) => r.status === 'failed').length);
        logger.warn('[sopExecute] Execution halted on step failure', { executionId, waveIndex: wave.waveIndex, error: failedStep.error });
        return { status: 'failed', waveIndex: wave.waveIndex, error: failedStep.error };
      }
    }

    await step.run('mark-completed', async () => {
      const db = createServerClient();
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
    await recordExecutionTrace(analyticsCtx, totalDurationMs, stepResults.length, 0, {
      id: template.id, name_en: template.name_en, stepCount: sopSteps.length,
    });

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

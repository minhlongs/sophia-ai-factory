import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { buildSOPGraph } from '@/tree/sop/dag-builder';
import type { LinearStep } from '@/tree/sop/dag-builder';
import { planExecution } from '@/tree/sop/parallel-planner';
import { toError } from '@/seed/utils/to-error';
import type { SopStepDef, SopStepResult } from './types';
import { runNode, recordExecutionTrace } from './step-verifier';
import { applyPromptOptimizations } from './prompt-optimizer';
import {
  fetchSopTemplate,
  markSopExecutionFailed,
  markSopExecutionRunning,
  persistSopWaveProgress,
  markSopExecutionCompleted,
} from './sop-execution-persistence';

export const sopExecute = inngest.createFunction(
  { id: 'sop-execute', retries: 1 },
  { event: 'sop/execution.requested' },
  async ({ event, step }) => {
    const { executionId, userId, orgId, sopTemplateId, inputJson } = event.data;
    logger.info('[sopExecute] Starting SOP execution', { executionId, userId, orgId, sopTemplateId });

    const template = await step.run('load-template', () => fetchSopTemplate(sopTemplateId));

    if (!template) {
      await step.run('mark-failed-no-template', () =>
        markSopExecutionFailed(executionId, `Template not found: ${sopTemplateId}`),
      );
      logger.error('[sopExecute] Execution failed — template not found', toError(`Template not found: ${sopTemplateId}`), { executionId, sopTemplateId });
      return { status: 'failed', error: `Template not found: ${sopTemplateId}` };
    }

    await step.run('mark-running', () => markSopExecutionRunning(executionId));

    let sopSteps: SopStepDef[];
    try {
      sopSteps = JSON.parse(template.steps_json) as SopStepDef[];
    } catch (parseErr) {
      const errMsg = parseErr instanceof Error ? parseErr.message : 'Invalid JSON in steps_json';
      await step.run('mark-failed-bad-json', () =>
        markSopExecutionFailed(executionId, `Failed to parse template steps: ${errMsg}`),
      );
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
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

    for (const wave of plan.waves) {
      const waveResults = await step.run(`wave-${wave.waveIndex}`, async () => {
        const waveNodes = wave.nodeIds.map((id) => nodeById.get(id)!);
        const results = await Promise.all(
          waveNodes.map((node) =>
            runNode(sopSteps[node.stepIndex], node.stepIndex, inputJson, stepResults, analyticsCtx),
          ),
        );
        const allSoFar = [...stepResults, ...results];
        await persistSopWaveProgress(executionId, wave.waveIndex, allSoFar, results.length);
        return results;
      });

      stepResults.push(...waveResults);

      const failedStep = waveResults.find((r) => r.status === 'failed');
      if (failedStep) {
        await step.run('mark-failed-step-error', () =>
          markSopExecutionFailed(executionId, failedStep.error ?? 'Step execution failed'),
        );
        await recordExecutionTrace(
          analyticsCtx,
          Date.now() - executionStart,
          stepResults.filter((r) => r.status === 'completed').length,
          stepResults.filter((r) => r.status === 'failed').length,
        );
        logger.warn('[sopExecute] Execution halted on step failure', { executionId, waveIndex: wave.waveIndex, error: failedStep.error });
        return { status: 'failed', waveIndex: wave.waveIndex, error: failedStep.error };
      }
    }

    await step.run('mark-completed', () =>
      markSopExecutionCompleted(executionId, sopSteps.length, stepResults, template.credits_per_run),
    );

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

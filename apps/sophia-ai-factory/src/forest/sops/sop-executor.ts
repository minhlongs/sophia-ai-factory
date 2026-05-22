/**
 * Inngest Function: sopExecute
 *
 * Registered via `forest/inngest/functions/index.ts` (barrel re-export).
 *
 * Event: 'sop/execution.requested'
 * Steps:
 *   1. load-template    — fetch sop_templates row, parse steps_json
 *   2. mark-running     — update sop_executions status to 'running'
 *   3..N. execute-step-N — run each SOP step sequentially (tool dispatch)
 *   N+1. mark-complete  — update sop_executions status to 'completed' or 'failed'
 *
 * Phase 01 Solo SOPs: tool handlers are stubs returning placeholder data.
 * Real integrations (TTS, video, script gen) are wired in later phases.
 */

import { inngest } from '@/forest/inngest/client';
import { getD1Client } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

// ── SOP Step definition ────────────────────────────────────────────────────

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
  // inputJson and priorResults are available for future phases to consume
  void inputJson;
  void priorResults;

  switch (step.tool) {
    case 'ai-script':
      // Phase 01 stub — real OpenRouter/AI integration in Phase 02
      return {
        script: '[PLACEHOLDER] Generated script for ' + step.name_en,
        word_count: 0,
        stub: true,
      };

    case 'ai-tts':
      // Phase 01 stub — real ElevenLabs/Fish Speech integration in Phase 03
      return {
        audio_url: 'https://placeholder.example.com/audio.mp3',
        duration_sec: 0,
        stub: true,
      };

    case 'ai-video':
      // Phase 01 stub — wires to existing video pipeline (Wan 2.1) in Phase 04
      return {
        video_url: 'https://placeholder.example.com/video.mp4',
        duration_sec: 0,
        stub: true,
      };

    case 'manual':
      // Manual steps are marked complete immediately — user completes out-of-band
      return {
        status: 'awaiting_user',
        message: 'Manual step — operator action required',
      };

    case 'upload':
      // Phase 01 stub — R2 upload integration in Phase 05
      return {
        upload_url: null,
        r2_key: null,
        stub: true,
      };

    case 'analytics':
      // Phase 01 stub — analytics aggregation in Phase 06
      return {
        metrics: {},
        stub: true,
      };

    default: {
      // Exhaustiveness guard — TypeScript will warn on unknown tool types
      const exhaustiveCheck: never = step.tool;
      throw new Error(`[sopExecute] Unknown step tool: ${exhaustiveCheck}`);
    }
  }
}

// ── Inngest Function ───────────────────────────────────────────────────────

export const sopExecute = inngest.createFunction(
  {
    id: 'sop-execute',
    retries: 1,
  },
  { event: 'sop/execution.requested' },
  async ({ event, step }) => {
    const { executionId, userId, orgId, sopTemplateId, inputJson } = event.data;

    logger.info('[sopExecute] Starting SOP execution', {
      executionId,
      userId,
      orgId,
      sopTemplateId,
    });

    // ── Step 1: Load SOP template ──────────────────────────────────────────
    const template = await step.run('load-template', async () => {
      const db = await getD1Client();

      const { data, error } = await db
        .from('sop_templates')
        .select('id, name_en, steps_json, credits_per_run')
        .eq('id', sopTemplateId)
        .maybeSingle();

      if (error) {
        throw new Error(`[sopExecute] Failed to load template ${sopTemplateId}: ${error.message}`);
      }

      if (!data) {
        logger.warn('[sopExecute] Template not found', { sopTemplateId });
        return null;
      }

      logger.info('[sopExecute] Template loaded', {
        templateId: data.id,
        templateName: data.name_en,
      });

      return data as {
        id: string;
        name_en: string;
        steps_json: string;
        credits_per_run: number;
      };
    });

    if (!template) {
      // Mark execution as failed — template not found
      await step.run('mark-failed-no-template', async () => {
        const db = await getD1Client();
        await db
          .from('sop_executions')
          .update({
            status: 'failed',
            error_message: `Template not found: ${sopTemplateId}`,
            completed_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000),
          })
          .eq('id', executionId);
      });

      logger.error(
        '[sopExecute] Execution failed — template not found',
        { executionId, sopTemplateId } as unknown as Error,
      );

      return { status: 'failed', error: `Template not found: ${sopTemplateId}` };
    }

    // ── Step 2: Mark execution as running ─────────────────────────────────
    await step.run('mark-running', async () => {
      const db = await getD1Client();
      await db
        .from('sop_executions')
        .update({
          status: 'running',
          current_step: 0,
          started_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        })
        .eq('id', executionId);

      logger.info('[sopExecute] Execution marked running', { executionId });
    });

    // Parse step definitions from template
    let sopSteps: SopStepDef[];
    try {
      sopSteps = JSON.parse(template.steps_json) as SopStepDef[];
    } catch (parseErr) {
      const errMsg = parseErr instanceof Error ? parseErr.message : 'Invalid JSON in steps_json';

      await step.run('mark-failed-bad-json', async () => {
        const db = await getD1Client();
        await db
          .from('sop_executions')
          .update({
            status: 'failed',
            error_message: `Failed to parse template steps: ${errMsg}`,
            completed_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000),
          })
          .eq('id', executionId);
      });

      logger.error('[sopExecute] Failed to parse steps_json', { executionId, templateId: sopTemplateId });
      return { status: 'failed', error: errMsg };
    }

    // ── Steps 3..N: Execute each SOP step sequentially ────────────────────
    const stepResults: SopStepResult[] = [];

    for (let i = 0; i < sopSteps.length; i++) {
      const sopStep = sopSteps[i];

      const result = await step.run(`execute-step-${i}`, async () => {
        const startedAt = Date.now();

        logger.info('[sopExecute] Executing step', {
          executionId,
          stepIndex: i,
          stepName: sopStep.name_en,
          tool: sopStep.tool,
        });

        let output: Record<string, unknown>;
        let stepStatus: 'completed' | 'failed';
        let stepError: string | null = null;

        try {
          output = await executeStepTool(sopStep, inputJson, stepResults);
          stepStatus = 'completed';
        } catch (err) {
          stepStatus = 'failed';
          stepError = err instanceof Error ? err.message : 'Unknown error';
          output = {};
          logger.error('[sopExecute] Step tool threw', {
            executionId,
            stepIndex: i,
            stepName: sopStep.name_en,
            error: stepError,
          } as unknown as Error);
        }

        const completedAt = Date.now();
        const stepResult: SopStepResult = {
          step_order: sopStep.order,
          step_name: sopStep.name_en,
          status: stepStatus,
          result: stepStatus === 'completed' ? output : null,
          error: stepError,
          started_at: startedAt,
          completed_at: completedAt,
          duration_ms: completedAt - startedAt,
        };

        // Persist progress after each step
        const db = await getD1Client();
        const updatedResults = [...stepResults, stepResult];

        await db
          .from('sop_executions')
          .update({
            current_step: i + 1,
            step_results: JSON.stringify(updatedResults),
            updated_at: Math.floor(completedAt / 1000),
          })
          .eq('id', executionId);

        logger.info('[sopExecute] Step persisted', {
          executionId,
          stepIndex: i,
          stepStatus,
          durationMs: stepResult.duration_ms,
        });

        return stepResult;
      });

      stepResults.push(result);

      // Halt on step failure — don't continue remaining steps
      if (result.status === 'failed') {
        await step.run('mark-failed-step-error', async () => {
          const db = await getD1Client();
          await db
            .from('sop_executions')
            .update({
              status: 'failed',
              error_message: result.error ?? 'Step execution failed',
              completed_at: Math.floor(Date.now() / 1000),
              updated_at: Math.floor(Date.now() / 1000),
            })
            .eq('id', executionId);
        });

        logger.warn('[sopExecute] Execution halted on step failure', {
          executionId,
          failedStepIndex: i,
          failedStepName: sopStep.name_en,
          error: result.error,
        });

        return {
          status: 'failed',
          lastStep: i,
          error: result.error,
        };
      }
    }

    // ── Final step: Mark execution as completed ────────────────────────────
    await step.run('mark-completed', async () => {
      const db = await getD1Client();
      const creditsUsed = template.credits_per_run ?? 1;

      await db
        .from('sop_executions')
        .update({
          status: 'completed',
          current_step: sopSteps.length,
          step_results: JSON.stringify(stepResults),
          credits_used: creditsUsed,
          completed_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        })
        .eq('id', executionId);

      logger.info('[sopExecute] Execution completed', {
        executionId,
        stepCount: sopSteps.length,
        creditsUsed,
      });
    });

    return {
      status: 'completed',
      executionId,
      stepCount: sopSteps.length,
      stepResults,
    };
  },
);

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { SopStepDef } from './types';

export async function applyPromptOptimizations(
  sopTemplateId: string,
  sopSteps: SopStepDef[],
): Promise<SopStepDef[]> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    const { results } = await db
      .prepare(
        `SELECT step_index, suggested_prompt FROM prompt_optimization_log
         WHERE sop_id = ? AND applied = 1
         ORDER BY created_at DESC`,
      )
      .bind(sopTemplateId)
      .all<{ step_index: number; suggested_prompt: string }>();

    if (results && results.length > 0) {
      const appliedPrompts = new Map<number, string>();
      for (const row of results) {
        if (!appliedPrompts.has(row.step_index)) {
          appliedPrompts.set(row.step_index, row.suggested_prompt);
        }
      }
      const updatedSteps = [...sopSteps];
      for (const [stepIndex, optimizedPrompt] of appliedPrompts.entries()) {
        if (updatedSteps[stepIndex]) {
          updatedSteps[stepIndex] = {
            ...updatedSteps[stepIndex],
            config: {
              ...updatedSteps[stepIndex].config,
              prompt: optimizedPrompt,
            },
          };
          logger.info('[sopExecute] Applied optimized prompt for step', {
            sopTemplateId,
            stepIndex,
            prompt: optimizedPrompt.substring(0, 50) + '...',
          });
        }
      }
      return updatedSteps;
    }
  } catch (err) {
    logger.warn('[sopExecute] Failed to check or apply optimized prompts (non-fatal)', {
      sopTemplateId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return sopSteps;
}

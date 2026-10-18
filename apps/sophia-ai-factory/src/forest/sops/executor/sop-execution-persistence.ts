import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { SopStepResult } from './types';

export interface SopTemplateRow {
  id: string;
  name_en: string;
  steps_json: string;
  credits_per_run: number;
}

export async function fetchSopTemplate(sopTemplateId: string): Promise<SopTemplateRow | null> {
  const db = createServerClient();
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
  logger.info('[sopExecute] Template loaded', { templateId: data.id, templateName: data.name_en });
  return data as unknown as SopTemplateRow;
}

export async function markSopExecutionFailed(executionId: string, errorMessage: string): Promise<void> {
  const db = createServerClient();
  const nowSec = Math.floor(Date.now() / 1000);
  await db
    .from('sop_executions')
    .update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: nowSec,
      updated_at: nowSec,
    })
    .eq('id', executionId);
}

export async function markSopExecutionRunning(executionId: string): Promise<void> {
  const db = createServerClient();
  const nowSec = Math.floor(Date.now() / 1000);
  await db
    .from('sop_executions')
    .update({
      status: 'running',
      current_step: 0,
      started_at: nowSec,
      updated_at: nowSec,
    })
    .eq('id', executionId);
  logger.info('[sopExecute] Execution marked running', { executionId });
}

export async function persistSopWaveProgress(
  executionId: string,
  waveIndex: number,
  allSoFar: SopStepResult[],
  waveResultCount: number,
): Promise<void> {
  const db = createServerClient();
  await db
    .from('sop_executions')
    .update({
      current_step: allSoFar.length,
      step_results: JSON.stringify(allSoFar),
      updated_at: Math.floor(Date.now() / 1000),
    })
    .eq('id', executionId);
  logger.info('[sopExecute] Wave persisted', { executionId, waveIndex, count: waveResultCount });
}

export async function markSopExecutionCompleted(
  executionId: string,
  stepCount: number,
  stepResults: SopStepResult[],
  creditsPerRun?: number,
): Promise<void> {
  const db = createServerClient();
  const creditsUsed = creditsPerRun ?? 1;
  const nowSec = Math.floor(Date.now() / 1000);
  await db
    .from('sop_executions')
    .update({
      status: 'completed',
      current_step: stepCount,
      step_results: JSON.stringify(stepResults),
      credits_used: creditsUsed,
      completed_at: nowSec,
      updated_at: nowSec,
    })
    .eq('id', executionId);
  logger.info('[sopExecute] Execution completed', { executionId, stepCount, creditsUsed });
}

import { logger } from '@/seed/utils/logger-utility';
import { NonRetriableError, type GetStepTools } from 'inngest';
import type { inngest } from '@/seed/inngest/client';

export interface StepRunnerOptions {
  campaignId: string;
  markEngineMissionFailed: (campaignId: string, error: string) => Promise<void>;
  notifyUser: (message: string) => Promise<unknown>;
}

export type InngestStepTools = GetStepTools<typeof inngest>;

export async function runStepSafely<T>(
  step: InngestStepTools,
  stepName: string,
  fn: () => Promise<T>,
  options: StepRunnerOptions,
): Promise<T> {
  try {
    return (await step.run(stepName, fn)) as T;
  } catch (rawErr) {
    if (rawErr instanceof NonRetriableError) throw rawErr;
    const errMsg = rawErr instanceof Error ? rawErr.message : String(rawErr);
    await options.markEngineMissionFailed(options.campaignId, `[${stepName}] ${errMsg}`).catch((err) => {
      logger.warn('Failed to mark engine mission failed', {
        error: String(err),
        context: 'runStepSafely',
        campaignId: options.campaignId,
        stepName,
      });
    });
    await options.notifyUser(`\u{1F4E9} Campaign failed at step "${stepName}". Contact support for assistance.`).catch((err) => {
      logger.warn('Failed to notify user of campaign failure', {
        error: String(err),
        context: 'runStepSafely',
        campaignId: options.campaignId,
        stepName,
      });
    });
    throw new NonRetriableError(`[${stepName}] ${errMsg}`, { cause: rawErr });
  }
}

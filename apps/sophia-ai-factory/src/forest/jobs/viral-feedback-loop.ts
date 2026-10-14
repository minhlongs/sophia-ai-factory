/**
 * Viral Feedback Loop — Closed-Loop Engagement Harvester & Concurrency Orchestrator
 *
 * Ingests published video telemetry (views, shares, retention, conversion clicks),
 * computes normalized Creative Effectiveness Scores (CES), and updates statistical
 * pattern weights in `playbook_patterns` via atomic OCC CAS.
 *
 * Runs as an Inngest scheduled cron (every 4 hours) or on-demand programmatic sync.
 *
 * Layer: forest (infrastructure & domain orchestration — depends on seed, tree, and forest).
 * Zero :any types. Zero console.log.
 *
 * @module forest/jobs/viral-feedback-loop
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  isCertificationBlocking,
  resolveCertifiedProvider,
} from '@/seed/ai/provider-certification';
import {
  calculateViralCES,
  ingestEngagementFeedback,
} from '@/tree/learning-loop/scoring-cas';
import { ingestRecentVideoAnalytics } from './viral-feedback-ingest';

export { calculateViralCES, ingestEngagementFeedback };

export interface ViralFeedbackSyncResult {
  readonly processed: number;
  readonly updated: number;
  readonly conflicts: number;
  readonly errors: string[];
  readonly activeProvider?: string;
  readonly providerDiverted?: boolean;
}

/**
 * Executes a full synchronization run over recent video engagement analytics.
 *
 * @param db Optional D1Database binding for test overrides or direct invocation.
 * @param lookbackMs Time window to scan for updated analytics (default: 5 hours).
 */
export async function runViralFeedbackSync(
  db?: D1Database,
  lookbackMs = 5 * 60 * 60 * 1000,
): Promise<ViralFeedbackSyncResult> {
  const d1 = db ?? (await getD1());
  if (!d1) {
    logger.warn('[ViralFeedbackLoop] D1 database unavailable for viral feedback sync');
    return { processed: 0, updated: 0, conflicts: 0, errors: ['D1_UNAVAILABLE'] };
  }

  // Actively resolve certified provider for downstream prompt optimization and text reasoning
  const isHermesBlocked = isCertificationBlocking('hermes');
  let certResolution;
  try {
    certResolution = isHermesBlocked
      ? resolveCertifiedProvider('hermes', ['openrouter', 'anthropic'])
      : {
          provider: 'hermes',
          diverted: false,
          originalProvider: 'hermes',
        };
    if (certResolution.diverted) {
      logger.warn('[ViralFeedbackLoop] Hermes provider blocked by certification — actively diverting downstream prompt optimization to certified provider', {
        originalProvider: certResolution.originalProvider,
        divertedProvider: certResolution.provider,
        reason: certResolution.reason,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[ViralFeedbackLoop] Critical: No certified provider available for viral feedback loop', { error: msg });
    return {
      processed: 0,
      updated: 0,
      conflicts: 0,
      errors: [msg],
    };
  }

  const since = Date.now() - lookbackMs;
  const { processed, updated, conflicts, errors } = await ingestRecentVideoAnalytics(d1, since);

  logger.info('[ViralFeedbackLoop] Viral feedback synchronization complete', {
    processed,
    updated,
    conflicts,
    errorsCount: errors.length,
  });

  return {
    processed,
    updated,
    conflicts,
    errors,
    activeProvider: certResolution.provider,
    providerDiverted: certResolution.diverted,
  };
}

/**
 * Inngest Scheduled Cron: Viral Feedback Loop
 * Runs every 4 hours to harvest engagement signals and update pattern scores.
 */
export const viralFeedbackLoopCron = inngest.createFunction(
  {
    id: 'viral-feedback-loop-cron',
    name: 'Viral Feedback Loop Cron',
  },
  { cron: '0 */4 * * *' },
  async ({ step }) => {
    return await step.run('run-viral-feedback-sync', async () => {
      return await runViralFeedbackSync();
    });
  },
);

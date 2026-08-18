/**
 * Inngest: Pattern Detection Cron (Phase 5a — Auto-Creative Playbook)
 *
 * Daily cron that runs the heuristic pattern detector across the configured
 * feature/metric/source combinations, persists detected patterns to
 * `playbook_patterns`, and generates bilingual rules via the guideline
 * generator (OpenRouter BYOK when a key is configured, template fallback
 * otherwise).
 *
 * Layer: forest (infrastructure orchestration). Calls land helpers via
 * dynamic import to respect the forest→land orchestration exception.
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { detectPatterns } from '@/forest/patterns/pattern-detector';
import { upsertPattern } from '@/forest/patterns/pattern-store';
import { generateRulesForPatterns, buildPlaybookLlm } from '@/forest/patterns/guideline-generator';

/** Feature/metric/source combinations to scan each cycle. */
const SCAN_JOBS: Array<{
  featureKey: string;
  metric: string;
  source: 'experiment' | 'memory' | 'roi';
}> = [
  { featureKey: 'content_type', metric: 'ctr', source: 'experiment' },
  { featureKey: 'content_type', metric: 'conversion', source: 'experiment' },
  { featureKey: 'hook_type', metric: 'ctr', source: 'memory' },
  { featureKey: 'channel', metric: 'ctr', source: 'memory' },
  { featureKey: 'duration', metric: 'ctr', source: 'memory' },
  { featureKey: 'posting_time_bucket', metric: 'ctr', source: 'memory' },
  { featureKey: 'content_id', metric: 'revenue', source: 'roi' },
];

export const patternDetectionCron = inngest.createFunction(
  { id: 'pattern-detection-cron' },
  { cron: '0 2 * * *' }, // daily at 02:00 UTC
  async () => {
    const workspaceId = process.env.DEFAULT_WORKSPACE_ID ?? 'default';
    let totalPatterns = 0;
    let totalRules = 0;

    for (const job of SCAN_JOBS) {
      try {
        const result = await detectPatterns(
          job.featureKey,
          job.metric,
          workspaceId,
          job.source,
        );

        if (result.insufficientData || result.patterns.length === 0) continue;

        for (const pattern of result.patterns) {
          try {
            await upsertPattern(pattern);
          } catch (err) {
            logger.warn('[pattern-detection-cron] upsertPattern failed', {
              featureKey: job.featureKey,
              featureValue: pattern.featureValue,
              error: String(err),
            });
          }
        }

        // Generate bilingual rules from the freshly detected patterns.
        // LLM is optional — templates always produce valid output.
        const llm = buildPlaybookLlm(workspaceId);
        const rules = await generateRulesForPatterns(result.patterns, llm);
        totalRules += rules.length;
        totalPatterns += result.patterns.length;

        logger.info('[pattern-detection-cron] Scan complete', {
          featureKey: job.featureKey,
          metric: job.metric,
          source: job.source,
          patterns: result.patterns.length,
          rules: rules.length,
        });
      } catch (err) {
        logger.error('[pattern-detection-cron] Scan failed',
          err instanceof Error ? err : new Error(String(err)),
          { featureKey: job.featureKey, metric: job.metric, source: job.source });
      }
    }

    return { scanned: SCAN_JOBS.length, patterns: totalPatterns, rules: totalRules };
  },
);
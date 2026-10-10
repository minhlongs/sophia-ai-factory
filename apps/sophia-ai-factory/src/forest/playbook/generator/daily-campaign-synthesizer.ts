import type { D1Database } from '@/seed/db/client';
import type { CampaignBlueprint, PlaybookPattern } from '@/seed/types/playbook-pattern';
import { logger } from '@/seed/utils/logger-utility';
import { MIN_PATTERN_CONFIDENCE } from './types';
import { generateCampaignBlueprint } from './campaign-generator';
import { saveCampaignBlueprint } from './campaign-validator';

/**
 * Autonomous Daily Campaign Generator — Phase 5: Auto-Creative Playbook
 */
export async function generateDailyCampaignBlueprints(
  db: D1Database,
  minConfidence: number = MIN_PATTERN_CONFIDENCE,
): Promise<CampaignBlueprint[]> {
  const stmt = db.prepare(
    `SELECT id, workspace_id, feature_key, feature_value, metric, avg_metric,
            sample_size, confidence, confidence_level, source, detected_at, created_at
     FROM playbook_patterns
     WHERE confidence >= ?
     ORDER BY workspace_id ASC, confidence DESC, detected_at DESC`,
  );

  const queryRes = await stmt.bind(minConfidence).all<{
    id: string;
    workspace_id: string;
    feature_key: string;
    feature_value: string;
    metric: string;
    avg_metric: number;
    sample_size: number;
    confidence: number;
    confidence_level: 'high' | 'medium' | 'low';
    source: 'mission' | 'experiment' | 'memory' | 'roi';
    detected_at: number;
    created_at: number;
  }>();

  const rawPatterns = queryRes.results ?? [];
  const blueprints: CampaignBlueprint[] = [];

  if (rawPatterns.length === 0) {
    logger.info('[CampaignGenerator] No patterns meet confidence threshold for daily generation', {
      minConfidence,
    });
    return [];
  }

  const patternsByWorkspace = new Map<string, PlaybookPattern[]>();
  for (const row of rawPatterns) {
    const p: PlaybookPattern = {
      id: row.id,
      workspaceId: row.workspace_id,
      featureKey: row.feature_key,
      featureValue: row.feature_value,
      metric: row.metric,
      avgMetric: row.avg_metric,
      sampleSize: row.sample_size,
      confidence: row.confidence,
      confidenceLevel: row.confidence_level,
      source: row.source,
      detectedAt: row.detected_at,
    };
    const list = patternsByWorkspace.get(row.workspace_id) || [];
    list.push(p);
    patternsByWorkspace.set(row.workspace_id, list);
  }

  for (const [workspaceId, wsPatterns] of patternsByWorkspace.entries()) {
    try {
      const topHook = wsPatterns.find(
        (p) =>
          (p.featureKey === 'hook_style' || p.featureKey === 'hook_type') &&
          p.confidence >= minConfidence,
      );
      const hookDesc = topHook ? `Top ${topHook.featureValue}` : 'Daily Viral Playbook';
      const topic = `Autonomous Daily Growth — ${hookDesc}`;

      const blueprint = await generateCampaignBlueprint(workspaceId, topic, wsPatterns);
      const saved = await saveCampaignBlueprint(blueprint, db);

      if (saved) {
        blueprints.push(blueprint);
        logger.info('[CampaignGenerator] Successfully synthesized daily blueprint', {
          workspaceId,
          blueprintId: blueprint.id,
          hookStyle: blueprint.hookStyle,
          voiceStyle: blueprint.voiceStyle,
          platform: blueprint.targetPlatform,
        });
      } else {
        logger.warn('[CampaignGenerator] Failed to persist daily blueprint', {
          workspaceId,
          blueprintId: blueprint.id,
        });
      }
    } catch (err) {
      logger.error('[CampaignGenerator] Error generating daily blueprint for workspace', {
        workspaceId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return blueprints;
}

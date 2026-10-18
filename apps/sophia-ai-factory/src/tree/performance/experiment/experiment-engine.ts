/**
 * Experiment Lifecycle Manager & D1 Repository Engine
 *
 * @module tree/performance/experiment/experiment-engine
 */

import { getD1 } from '@/seed/db/client';
import type { Experiment } from '@/seed/types/creative-domain';
import { PerformanceError } from '../errors';
import {
  getExperiment,
  listExperiments,
} from './experiment-queries';
import {
  completeExperiment,
  startExperiment,
} from './experiment-transitions';

export {
  completeExperiment,
  getExperiment,
  listExperiments,
  startExperiment,
};

export async function createExperiment(
  experiment: Experiment,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  try {
    await db
      .prepare(
        `INSERT INTO experiments
           (id, workspace_id, project_id, hypothesis, metric, audience, channel,
            status, started_at, ended_at, winner_variant_id, confidence, result,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        experiment.id, experiment.workspaceId, experiment.projectId,
        experiment.hypothesis, experiment.metric, experiment.audience,
        experiment.channel, experiment.status,
        experiment.startedAt ?? null, experiment.endedAt ?? null,
        experiment.winnerVariantId ?? null, experiment.confidence ?? null,
        experiment.result ?? null,
        experiment.createdAt || now, experiment.updatedAt || now,
      )
      .run();

    for (const v of experiment.variants) {
      await db
        .prepare(
          `INSERT INTO experiment_variants
             (id, experiment_id, name, description, asset_id, traffic_percent)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(v.id, v.experimentId, v.name, v.description, v.assetId ?? null, v.trafficPercent)
        .run();
    }
  } catch (err) {
    throw new PerformanceError(
      'INSERT_FAILED',
      err instanceof Error ? err.message : 'unknown',
    );
  }
}

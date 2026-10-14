import type { D1Database } from '@/seed/db/client';
import type {
  InboundLeadPayload,
  QualificationResult,
} from '@/seed/types/autonomous-swarm';
import { logger } from '@/seed/utils/logger-utility';
import { qualifyInboundLead } from './lead-evaluator';

/**
 * Orchestrates lead qualification through an edge swarm node.
 * Records telemetry and updates node task metrics if node is specified.
 */
export async function processLeadWithSwarmNode(
  db: D1Database,
  payload: InboundLeadPayload,
  swarmNodeId?: string
): Promise<QualificationResult> {
  const result = qualifyInboundLead(payload);

  if (swarmNodeId) {
    try {
      await db
        .prepare(`
          UPDATE autonomous_swarm_nodes
          SET
            active_tasks = MAX(0, active_tasks + 1),
            last_heartbeat_at = ?1,
            updated_at = ?1
          WHERE id = ?2
        `)
        .bind(Date.now(), swarmNodeId)
        .run();
    } catch (err) {
      logger.warn('[sales-qualifier-bot] Failed to update swarm node telemetry', {
        swarmNodeId,
        error: String(err),
      });
    }
  }

  logger.info('[sales-qualifier-bot] Inbound lead qualified', {
    dealId: result.dealId,
    company: payload.companyName,
    bantScore: result.bantScore,
    pipelineTier: result.pipelineTier,
    autoQualified: result.autoQualified,
  });

  return result;
}

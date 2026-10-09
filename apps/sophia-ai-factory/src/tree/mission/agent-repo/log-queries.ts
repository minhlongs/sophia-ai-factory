/**
 * Agent Run Logging
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/mission/agent-repo/log-queries
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { AgentLogEntry } from './types';
import { toJson } from './helpers';

export async function appendAgentLog(
  entry: AgentLogEntry
): Promise<Result<AgentLogEntry, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    await db.prepare(
      `INSERT INTO agent_run_logs (id, agent_run_id, phase, level, message, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(entry.id, entry.runId, entry.phase, entry.level, entry.message, toJson(entry.metadata), entry.timestamp)
      .run();

    return success(entry);
  } catch (err) {
    logger.error('appendAgentLog failed', { error: err instanceof Error ? err.message : String(err), entry });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

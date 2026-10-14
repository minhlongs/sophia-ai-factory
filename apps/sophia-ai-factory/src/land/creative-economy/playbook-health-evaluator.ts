/**
 * Window constants, failure rate queries, and health status evaluation for playbook health.
 * @module land/creative-economy/playbook-health-evaluator
 */

import type { createServerClient } from '@/seed/db/client';

/** Exact same window constants as auto-apply-monitor.ts (seconds) */
export const RECENT_WINDOW_SEC = 7 * 24 * 60 * 60;      // 7 days
export const BASELINE_WINDOW_SEC = 30 * 24 * 60 * 60;   // 30 days
export const BASELINE_MIN_AGE_SEC = 7 * 24 * 60 * 60;   // 7 days
const ROLLBACK_FAILURE_MULTIPLIER = 2;
const ABSOLUTE_FAILURE_THRESHOLD = 0.5;

export interface FailureCounts {
  total: number;
  failed: number | null;
}

export interface WindowResult {
  failureRate: number;
  total: number;
}

export interface InstallConfig {
  ruleId: string;
  autoApply: number;
}

export async function fetchFailureCounts(
  db: ReturnType<typeof createServerClient>,
  installationId: string,
  startSec: number,
  endSec: number | null = null,
): Promise<FailureCounts> {
  let sql = `SELECT COUNT(*) AS total,
                  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
           FROM sop_executions
           WHERE installation_id = ?1
             AND created_at >= ?2
             AND status IN ('failed', 'completed')`;
  const params = [installationId, startSec];
  if (endSec !== null) {
    sql += ' AND created_at < ?3';
    params.push(endSec);
  }
  return (await db.prepare(sql).bind(...params).first<FailureCounts>()) ?? { total: 0, failed: 0 };
}

export function parseInstallConfig(configValues: string): InstallConfig {
  try {
    const cfg = JSON.parse(configValues) as { ruleId?: string; autoApply?: number };
    return { ruleId: cfg.ruleId ?? '', autoApply: cfg.autoApply ?? 1 };
  } catch {
    return { ruleId: '', autoApply: 1 };
  }
}

export async function evaluateHealthStatus(
  db: ReturnType<typeof createServerClient>,
  installConfig: InstallConfig,
  recent: WindowResult,
  baseline: WindowResult,
): Promise<{ status: 'healthy' | 'at_risk' | 'rolled_back'; lastRollbackAtSec: number | null }> {
  const spike = recent.failureRate > baseline.failureRate * ROLLBACK_FAILURE_MULTIPLIER;
  const absolute = recent.failureRate > ABSOLUTE_FAILURE_THRESHOLD;

  let status: 'healthy' | 'at_risk' | 'rolled_back' = 'healthy';
  if (recent.total === 0) {
    status = 'healthy';
  } else if (spike || absolute) {
    status = installConfig.autoApply === 1 ? 'at_risk' : 'rolled_back';
  }

  let lastRollbackAtSec: number | null = null;
  if (installConfig.ruleId) {
    const rb = await db
      .prepare('SELECT updated_at FROM playbook_rules WHERE id = ?1 AND rollback_count > 0')
      .bind(installConfig.ruleId)
      .first<{ updated_at: number }>();
    if (rb?.updated_at) {
      lastRollbackAtSec = Math.floor(rb.updated_at / 1000);
    }
  }

  return { status, lastRollbackAtSec };
}

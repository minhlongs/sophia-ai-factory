/**
 * Server Action: Get playbook health for auto-apply installations.
 *
 * Replicates the evaluation logic from auto-apply-monitor.ts (forest) but READ-only.
 * Scopes by user_id because user_sop_installations has NO workspace column
 * (migration 0056) — C5 resolution: install rows are user-scoped; we derive
 * workspace via org_members(user_id -> org_id).
 *
 * Timestamp discipline: sop_executions.created_at = SECONDS.
 * We convert SECONDS to ms for internal consistency where needed, but the
 * comparison windows (7d recent vs 8-30d baseline) match auto-apply-monitor.ts
 * exactly to produce identical health statuses.
 *
 * @module land/creative-economy/playbook-health
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { PlaybookHealthRow, DashboardResult } from './types';

const schema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
});

/** Exact same window constants as auto-apply-monitor.ts (seconds) */
const RECENT_WINDOW_SEC = 7 * 24 * 60 * 60;        // 7 days
const BASELINE_WINDOW_SEC = 30 * 24 * 60 * 60;    // 30 days
const BASELINE_MIN_AGE_SEC = 7 * 24 * 60 * 60;    // 7 days (baseline starts 30d ago, ends 7d ago)
const ROLLBACK_FAILURE_MULTIPLIER = 2;
const ABSOLUTE_FAILURE_THRESHOLD = 0.5;

interface FailureCounts {
  total: number;
  failed: number | null;
}

interface WindowResult {
  failureRate: number;
  total: number;
}

async function fetchFailureCounts(
  db: ReturnType<typeof createServerClient>,
  installationId: string,
  startSec: number,
  endSec: number | null = null
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

interface InstallConfig {
  ruleId: string;
  autoApply: number;
}

function parseInstallConfig(configValues: string): InstallConfig {
  try {
    const cfg = JSON.parse(configValues) as { ruleId?: string; autoApply?: number };
    return { ruleId: cfg.ruleId ?? '', autoApply: cfg.autoApply ?? 1 };
  } catch {
    return { ruleId: '', autoApply: 1 };
  }
}

async function evaluateHealthStatus(
  db: ReturnType<typeof createServerClient>,
  installConfig: InstallConfig,
  recent: WindowResult,
  baseline: WindowResult
): Promise<{ status: 'healthy' | 'at_risk' | 'rolled_back'; lastRollbackAtSec: number | null }> {
  const spike = recent.failureRate > baseline.failureRate * ROLLBACK_FAILURE_MULTIPLIER;
  const absolute = recent.failureRate > ABSOLUTE_FAILURE_THRESHOLD;

  let status: 'healthy' | 'at_risk' | 'rolled_back' = 'healthy';
  if (recent.total === 0) {
    status = 'healthy';
  } else if (spike || absolute) {
    status = installConfig.autoApply === 1 ? 'at_risk' : 'rolled_back';
  }

  // Last rollback timestamp
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

export async function getPlaybookHealth(
  input: z.infer<typeof schema>
): Promise<DashboardResult<PlaybookHealthRow[]>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const db = createServerClient();

    // Verify workspace membership (IDOR prevention)
    const membership = await db
      .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(parsed.data.workspaceId, user.id)
      .first();

    if (!membership) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // Find playbook-sourced installs for THIS USER, including rolled-back rows
    // (autoApply = 0) so the dashboard can surface rolled_back status.
    // (user_sop_installations has no workspace column → scope by user_id)
    const installs = await db
      .prepare(
        `SELECT id, config_values FROM user_sop_installations
         WHERE user_id = ?1
           AND config_values IS NOT NULL
           AND json_extract(config_values, '$.source') = 'playbook'`,
      )
      .bind(user.id)
      .all<{ id: string; config_values: string }>();

    const nowSec = Math.floor(Date.now() / 1000);
    const recentStart = nowSec - RECENT_WINDOW_SEC;
    const baselineStart = nowSec - BASELINE_WINDOW_SEC;
    const baselineEnd = nowSec - BASELINE_MIN_AGE_SEC;

    const rows = installs.results ?? [];
    const health: PlaybookHealthRow[] = [];

    for (const row of rows) {
      const installConfig = parseInstallConfig(row.config_values);
      const recent = await fetchFailureCounts(db, row.id, recentStart);
      const baseline = await fetchFailureCounts(db, row.id, baselineStart, baselineEnd);

      const recentResult: WindowResult = {
        failureRate: recent.total > 0 ? (recent.failed ?? 0) / recent.total : 0,
        total: recent.total,
      };
      const baselineResult: WindowResult = {
        failureRate: baseline.total > 0 ? (baseline.failed ?? 0) / baseline.total : 0,
        total: baseline.total,
      };

      const { status, lastRollbackAtSec } = await evaluateHealthStatus(db, installConfig, recentResult, baselineResult);

      health.push({
        installationId: row.id,
        ruleId: installConfig.ruleId,
        status,
        recentFailureRate: recentResult.failureRate,
        baselineFailureRate: baselineResult.failureRate,
        lastRollbackAtSec,
      });
    }

    return success(health);
  } catch (err) {
    const error = toError(err);
    logger.error('[CreativeEconomy] getPlaybookHealth failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}
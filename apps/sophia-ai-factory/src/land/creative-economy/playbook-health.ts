/**
 * Server Action: Get playbook health for auto-apply installations.
 *
 * @module land/creative-economy/playbook-health
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { createServerClient } from '@/seed/db/client';
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { PlaybookHealthRow, DashboardResult } from './types';
import {
  RECENT_WINDOW_SEC,
  BASELINE_WINDOW_SEC,
  BASELINE_MIN_AGE_SEC,
  fetchFailureCounts,
  parseInstallConfig,
  evaluateHealthStatus,
  type WindowResult,
} from './playbook-health-evaluator';

const schema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
});

export async function getPlaybookHealth(
  input: z.infer<typeof schema>,
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

    const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id, db);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

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

      const { status, lastRollbackAtSec } = await evaluateHealthStatus(
        db,
        installConfig,
        recentResult,
        baselineResult,
      );

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

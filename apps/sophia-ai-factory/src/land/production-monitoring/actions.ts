/**
 * Production Monitoring — server actions.
 *
 * Auth + workspace-membership boundary for the production dashboard KPIs.
 * Mirrors the creative-economy action pattern: Zod validation, getCurrentUser,
 * org_members membership check (IDOR prevention), Result<T,E> everywhere.
 *
 * @module land/production-monitoring/actions
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getProductionDashboardSummary } from './dashboard-summary';
import type {
  ProductionDashboardSummary,
  ProductionMonitoringResult,
} from './types';

const schema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
});

/**
 * Server Action: six production KPIs for a workspace.
 * Validates input, requires an authenticated session, and verifies the user
 * is a member of the workspace before reading production_graph_runs.
 */
export async function getDashboardSummaryAction(
  input: z.infer<typeof schema>,
): Promise<ProductionMonitoringResult<ProductionDashboardSummary>> {
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

    return await getProductionDashboardSummary(parsed.data.workspaceId);
  } catch (err) {
    const error = toError(err);
    logger.error('[ProductionMonitoring] getDashboardSummaryAction failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

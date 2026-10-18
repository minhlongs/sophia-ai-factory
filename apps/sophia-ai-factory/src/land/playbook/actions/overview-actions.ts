/**
 * Playbook Overview Action.
 *
 * Layer: land (business workflows / Server Actions)
 * STRICT 4-LAYER BOUNDARY: imports only from @/seed and @/tree.
 *
 * @module land/playbook/actions/overview-actions
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { logger } from '@/seed/utils/logger-utility';
import type {
  PlaybookPattern,
  PlaybookRule,
  CampaignBlueprint,
  RecurringCampaignSchedule,
} from '@/seed/types/playbook-pattern';
import type { ActionResult, PlaybookOverviewData } from './types';
import { getDbAccess } from './db-access';
import { fetchOverviewData } from './overview-queries';

export async function getPlaybookOverviewAction(
  workspaceId: string,
): Promise<ActionResult<PlaybookOverviewData>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const targetWorkspace = workspaceId || user.id;
    const { d1 } = await getDbAccess();

    if (d1 && targetWorkspace !== user.id) {
      const hasAccess = await verifyWorkspaceAccess(targetWorkspace, user.id, d1);
      if (!hasAccess) {
        return { success: false, error: 'Access denied to workspace', code: 'FORBIDDEN' };
      }
    }

    const patterns: PlaybookPattern[] = [];
    const rules: PlaybookRule[] = [];
    const blueprints: CampaignBlueprint[] = [];
    const schedules: RecurringCampaignSchedule[] = [];

    if (d1) {
      await fetchOverviewData(d1, targetWorkspace, user.id, {
        patterns,
        rules,
        blueprints,
        schedules,
      });
    }

    return {
      success: true,
      data: { patterns, rules, blueprints, schedules },
    };
  } catch (err) {
    logger.error(
      '[getPlaybookOverviewAction] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
      { workspaceId },
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch playbook overview',
      code: 'INTERNAL_ERROR',
    };
  }
}

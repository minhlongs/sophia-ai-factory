/**
 * Playbook Overview D1 Query Helper.
 *
 * Layer: land
 * @module land/playbook/actions/overview-queries
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  PlaybookPattern,
  PlaybookRule,
  PlaybookPatternRow,
  PlaybookRuleRow,
  CampaignBlueprint,
  CampaignBlueprintRow,
  RecurringCampaignSchedule,
  RecurringCampaignScheduleRow,
} from '@/seed/types/playbook-pattern';
import type { getDbAccess } from './db-access';
import {
  mapPatternRow,
  mapRuleRow,
  mapBlueprintRow,
  mapRecurringScheduleRow,
} from './overview-mappers';

export interface OverviewCollections {
  patterns: PlaybookPattern[];
  rules: PlaybookRule[];
  blueprints: CampaignBlueprint[];
  schedules: RecurringCampaignSchedule[];
}

export async function fetchOverviewData(
  d1: NonNullable<Awaited<ReturnType<typeof getDbAccess>>['d1']>,
  wsId: string,
  userId: string,
  cols: OverviewCollections,
): Promise<void> {
  try {
    const pRows = await d1.prepare(`SELECT * FROM playbook_patterns WHERE workspace_id = ? ORDER BY detected_at DESC LIMIT 100`).bind(wsId).all<PlaybookPatternRow>();
    cols.patterns.push(...(pRows.results || []).map(mapPatternRow));
  } catch (err) {
    logger.warn('[getPlaybookOverviewAction] patterns query failed', { error: String(err) });
  }

  try {
    const rRows = await d1.prepare(`SELECT * FROM playbook_rules WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 100`).bind(wsId).all<PlaybookRuleRow>();
    cols.rules.push(...(rRows.results || []).map(mapRuleRow));
  } catch (err) {
    logger.warn('[getPlaybookOverviewAction] rules query failed', { error: String(err) });
  }

  try {
    const bRows = await d1.prepare(`SELECT * FROM campaign_blueprints WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50`).bind(wsId).all<CampaignBlueprintRow>();
    cols.blueprints.push(...(bRows.results || []).map(mapBlueprintRow));
  } catch (err) {
    logger.warn('[getPlaybookOverviewAction] blueprints query failed', { error: String(err) });
  }

  try {
    const sRows = await d1.prepare(`SELECT * FROM recurring_campaign_runs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50`).bind(wsId).all<RecurringCampaignScheduleRow>();
    cols.schedules.push(...(sRows.results || []).map(mapRecurringScheduleRow));

    if (cols.schedules.length === 0) {
      const scRows = await d1.prepare(`SELECT id, user_id, topic, interval_days, next_run_date, last_run_date, is_active FROM scheduled_campaigns WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`).bind(userId).all<{ id: string; user_id: string; topic: string; interval_days: number; next_run_date: string; last_run_date: string | null; is_active: number }>();
      for (const sc of scRows.results || []) {
        cols.schedules.push({
          id: sc.id,
          workspaceId: wsId,
          userId: sc.user_id,
          blueprintId: sc.topic || 'default',
          scheduleCron: `0 0 */${sc.interval_days || 7} * *`,
          batchSize: 1,
          nextRunAt: sc.next_run_date ? new Date(`${sc.next_run_date}T00:00:00Z`).getTime() : Date.now(),
          lastRunAt: sc.last_run_date ? new Date(`${sc.last_run_date}T00:00:00Z`).getTime() : null,
          isActive: Boolean(sc.is_active),
          totalRuns: 0,
          lastStatus: 'idle',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
  } catch (err) {
    logger.warn('[getPlaybookOverviewAction] schedules query failed', { error: String(err) });
  }
}

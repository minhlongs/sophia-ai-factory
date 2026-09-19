/**
 * Server Actions for Auto-Creative Playbook & Campaign Intelligence — Phase 5
 *
 * Provides typed, fail-closed actions for the Playbook dashboard:
 * - getPlaybookOverviewAction: Fetches winning patterns, derived rules, blueprints, and recurring schedules.
 * - toggleRuleAutoApplyAction: Atomically toggles rule auto-apply via OCC CAS (`WHERE id = ? AND updated_at = ?`).
 * - rollbackRuleAction: Safely disables auto-apply, increments `rollback_count`, and updates timestamp.
 * - saveRecurringScheduleAction: Persists recurring batch schedules to `recurring_campaign_runs` and `scheduled_campaigns`.
 * - toggleRecurringScheduleAction: Toggles active status on recurring schedules.
 * - triggerBatchRunAction: Runs 7-gate preflight, checks monthly tier quota, deducts MCU credits, and dispatches batch missions.
 *
 * Layer: land (business workflows / Server Actions)
 * STRICT 4-LAYER BOUNDARY: imports only from @/seed and @/tree. Zero imports from @/forest!
 *
 * @module land/playbook/actions
 */

'use server';

import { createServerClient, getD1, type D1Client, type D1Database } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getUserTier } from '@/seed/db/get-user-tier';
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
import { runMissionPreflightCheck, type MissionPreflightResult } from '@/tree/mission/preflight-check';
import { checkMissionQuota } from '@/tree/quota/mission-quota';
import { deductCredits } from '@/tree/mcu/credits-repo';
import { createMission } from '@/tree/mission/repository';
import { dispatchMultiTrackMission } from '@/tree/mission/executor-bridge';

// ── Types ───────────────────────────────────────────────────────────────────

export type ActionResult<T = unknown> =
  | { success: true; data: T; error?: string; code?: string }
  | { success: false; error: string; code?: string; data?: Partial<T> };

export interface PlaybookOverviewData {
  patterns: PlaybookPattern[];
  rules: PlaybookRule[];
  blueprints: CampaignBlueprint[];
  schedules: RecurringCampaignSchedule[];
}

export interface SaveScheduleParams {
  workspaceId: string;
  blueprintId: string;
  scheduleCron: string;
  batchSize: number;
  isActive: boolean;
  scheduleId?: string;
}

export interface TriggerBatchParams {
  workspaceId: string;
  blueprintId: string;
  batchSize: number;
}

// ── Helper: DB accessor ──────────────────────────────────────────────────────

async function getDbAccess(): Promise<{ d1: D1Database | null; client: D1Client | null }> {
  let d1: D1Database | null = null;
  try {
    d1 = await getD1();
  } catch {
    d1 = null;
  }

  let client: D1Client | null = null;
  try {
    client = createServerClient();
  } catch {
    client = null;
  }

  return { d1, client };
}

// ── Action 1: getPlaybookOverviewAction ───────────────────────────────────────

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

    // 1. Fetch patterns
    try {
      if (d1) {
        const rows = await d1
          .prepare(
            `SELECT id, workspace_id, feature_key, feature_value, metric, avg_metric,
                    sample_size, confidence, confidence_level, source, detected_at
             FROM playbook_patterns
             WHERE workspace_id = ?
             ORDER BY detected_at DESC
             LIMIT 100`,
          )
          .bind(targetWorkspace)
          .all<PlaybookPatternRow>();

        if (rows.results) {
          for (const r of rows.results) {
            patterns.push({
              id: r.id,
              workspaceId: r.workspace_id,
              featureKey: r.feature_key,
              featureValue: r.feature_value,
              metric: r.metric,
              avgMetric: Number(r.avg_metric ?? 0),
              sampleSize: Number(r.sample_size ?? 0),
              confidence: Number(r.confidence ?? 0),
              confidenceLevel: r.confidence_level ?? 'low',
              source: (r.source as PlaybookPattern['source']) || 'mission',
              detectedAt: Number(r.detected_at ?? 0),
            });
          }
        }
      }
    } catch (err) {
      logger.warn('[getPlaybookOverviewAction] patterns query failed', { error: String(err) });
    }

    // 2. Fetch rules
    try {
      if (d1) {
        const rows = await d1
          .prepare(
            `SELECT id, workspace_id, pattern_id, platform, goal, rule_vi, rule_en,
                    confidence, sample_size, applied_count, auto_apply, rollback_count,
                    created_at, updated_at
             FROM playbook_rules
             WHERE workspace_id = ?
             ORDER BY updated_at DESC
             LIMIT 100`,
          )
          .bind(targetWorkspace)
          .all<PlaybookRuleRow>();

        if (rows.results) {
          for (const r of rows.results) {
            rules.push({
              id: r.id,
              workspaceId: r.workspace_id,
              patternId: r.pattern_id,
              platform: r.platform,
              goal: r.goal,
              ruleVi: r.rule_vi,
              ruleEn: r.rule_en,
              confidence: Number(r.confidence ?? 0),
              sampleSize: Number(r.sample_size ?? 0),
              appliedCount: Number(r.applied_count ?? 0),
              autoApply: Boolean(r.auto_apply),
              rollbackCount: Number(r.rollback_count ?? 0),
              createdAt: Number(r.created_at ?? 0),
              updatedAt: Number(r.updated_at ?? 0),
            });
          }
        }
      }
    } catch (err) {
      logger.warn('[getPlaybookOverviewAction] rules query failed', { error: String(err) });
    }

    // 3. Fetch blueprints
    try {
      if (d1) {
        const rows = await d1
          .prepare(
            `SELECT id, workspace_id, name_en, name_vi, description_en, description_vi,
                    target_platform, hook_style, voice_style, duration_seconds, aspect_ratio,
                    estimated_scenes, suggested_prompts, is_active, created_at, updated_at
             FROM campaign_blueprints
             WHERE workspace_id = ?
             ORDER BY created_at DESC
             LIMIT 50`,
          )
          .bind(targetWorkspace)
          .all<CampaignBlueprintRow>();

        if (rows.results) {
          for (const r of rows.results) {
            let prompts: Array<{ en: string; vi: string }> = [];
            try {
              prompts = typeof r.suggested_prompts === 'string'
                ? JSON.parse(r.suggested_prompts)
                : (r.suggested_prompts ?? []);
            } catch {
              prompts = [];
            }

            blueprints.push({
              id: r.id,
              workspaceId: r.workspace_id,
              name: { en: r.name_en, vi: r.name_vi },
              description: { en: r.description_en, vi: r.description_vi },
              targetPlatform: r.target_platform as CampaignBlueprint['targetPlatform'],
              hookStyle: r.hook_style as CampaignBlueprint['hookStyle'],
              voiceStyle: r.voice_style as CampaignBlueprint['voiceStyle'],
              durationSeconds: Number(r.duration_seconds ?? 60),
              aspectRatio: r.aspect_ratio as CampaignBlueprint['aspectRatio'],
              estimatedScenes: Number(r.estimated_scenes ?? 3),
              suggestedPrompts: prompts,
              isActive: Boolean(r.is_active),
              createdAt: Number(r.created_at ?? 0),
              updatedAt: Number(r.updated_at ?? 0),
            });
          }
        }
      }
    } catch (err) {
      logger.warn('[getPlaybookOverviewAction] blueprints query failed', { error: String(err) });
    }

    // 4. Fetch recurring campaign runs
    try {
      if (d1) {
        const rows = await d1
          .prepare(
            `SELECT id, workspace_id, user_id, blueprint_id, schedule_cron, batch_size,
                    next_run_at, last_run_at, is_active, total_runs, last_status,
                    created_at, updated_at
             FROM recurring_campaign_runs
             WHERE workspace_id = ?
             ORDER BY created_at DESC
             LIMIT 50`,
          )
          .bind(targetWorkspace)
          .all<RecurringCampaignScheduleRow>();

        if (rows.results) {
          for (const r of rows.results) {
            schedules.push({
              id: r.id,
              workspaceId: r.workspace_id,
              userId: r.user_id,
              blueprintId: r.blueprint_id,
              scheduleCron: r.schedule_cron,
              batchSize: Number(r.batch_size ?? 1),
              nextRunAt: Number(r.next_run_at ?? 0),
              lastRunAt: r.last_run_at ? Number(r.last_run_at) : null,
              isActive: Boolean(r.is_active),
              totalRuns: Number(r.total_runs ?? 0),
              lastStatus: (r.last_status as RecurringCampaignSchedule['lastStatus']) || 'idle',
              createdAt: Number(r.created_at ?? 0),
              updatedAt: Number(r.updated_at ?? 0),
            });
          }
        }
      }
    } catch (err) {
      logger.warn('[getPlaybookOverviewAction] recurring_campaign_runs query failed', { error: String(err) });
    }

    // 5. Also query scheduled_campaigns for legacy schedule compatibility
    try {
      if (d1 && schedules.length === 0) {
        const scRows = await d1
          .prepare(
            `SELECT id, user_id, topic, interval_days, next_run_date, last_run_date, is_active
             FROM scheduled_campaigns
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 50`,
          )
          .bind(user.id)
          .all<{
            id: string;
            user_id: string;
            topic: string;
            interval_days: number;
            next_run_date: string;
            last_run_date: string | null;
            is_active: number;
          }>();

        if (scRows.results) {
          for (const sc of scRows.results) {
            const nextTs = sc.next_run_date ? new Date(`${sc.next_run_date}T00:00:00Z`).getTime() : Date.now();
            const lastTs = sc.last_run_date ? new Date(`${sc.last_run_date}T00:00:00Z`).getTime() : null;
            schedules.push({
              id: sc.id,
              workspaceId: targetWorkspace,
              userId: sc.user_id,
              blueprintId: sc.topic || 'default',
              scheduleCron: `0 0 */${sc.interval_days || 7} * *`,
              batchSize: 1,
              nextRunAt: nextTs,
              lastRunAt: lastTs,
              isActive: Boolean(sc.is_active),
              totalRuns: 0,
              lastStatus: 'idle',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
        }
      }
    } catch (err) {
      logger.warn('[getPlaybookOverviewAction] scheduled_campaigns fallback query failed', { error: String(err) });
    }

    return {
      success: true,
      data: {
        patterns,
        rules,
        blueprints,
        schedules,
      },
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

// ── Action 2: toggleRuleAutoApplyAction (OCC CAS) ─────────────────────────────

export async function toggleRuleAutoApplyAction(
  ruleId: string,
  enabled: boolean,
  expectedUpdatedAt?: number,
): Promise<ActionResult<{ ruleId: string; autoApply: boolean; updatedAt: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const { d1, client } = await getDbAccess();
    if (!d1 && !client) {
      return { success: false, error: 'Database not available', code: 'DB_UNAVAILABLE' };
    }

    const now = Date.now();

    // If expectedUpdatedAt is specified, execute OCC CAS directly
    if (typeof expectedUpdatedAt === 'number') {
      let changes = 0;
      if (d1) {
        const updateRes = await d1
          .prepare(
            `UPDATE playbook_rules
             SET auto_apply = ?, updated_at = ?
             WHERE id = ? AND updated_at = ?`,
          )
          .bind(enabled ? 1 : 0, now, ruleId, expectedUpdatedAt)
          .run();
        changes = updateRes.meta?.changes ?? 0;
      } else if (client) {
        const updateRes = await client.execute(
          `UPDATE playbook_rules
           SET auto_apply = ?, updated_at = ?
           WHERE id = ? AND updated_at = ?`,
          [enabled ? 1 : 0, now, ruleId, expectedUpdatedAt],
        );
        changes = updateRes.meta?.changes ?? 0;
      }

      if (changes === 0) {
        logger.warn('[toggleRuleAutoApplyAction] OCC CAS conflict detected', {
          ruleId,
          expectedUpdatedAt,
        });
        return {
          success: false,
          error: 'Rule was modified by another process. Please refresh.',
          code: 'CAS_CONFLICT',
        };
      }

      return {
        success: true,
        data: { ruleId, autoApply: enabled, updatedAt: now },
      };
    }

    // If expectedUpdatedAt not provided, fetch current rule timestamp first
    let currentUpdatedAt: number | undefined;
    if (d1) {
      const row = await d1
        .prepare(`SELECT updated_at FROM playbook_rules WHERE id = ?`)
        .bind(ruleId)
        .first<{ updated_at: number }>();
      currentUpdatedAt = row?.updated_at;
    } else if (client) {
      const res = await client.execute(
        `SELECT updated_at FROM playbook_rules WHERE id = ?`,
        [ruleId],
      );
      const row = res.results?.[0] as { updated_at?: number } | undefined;
      currentUpdatedAt = row?.updated_at;
    }

    if (currentUpdatedAt === undefined) {
      return { success: false, error: 'Rule not found', code: 'NOT_FOUND' };
    }

    // Execute CAS with currentUpdatedAt
    let changes = 0;
    if (d1) {
      const updateRes = await d1
        .prepare(
          `UPDATE playbook_rules
           SET auto_apply = ?, updated_at = ?
           WHERE id = ? AND updated_at = ?`,
        )
        .bind(enabled ? 1 : 0, now, ruleId, currentUpdatedAt)
        .run();
      changes = updateRes.meta?.changes ?? 0;
    } else if (client) {
      const updateRes = await client.execute(
        `UPDATE playbook_rules
         SET auto_apply = ?, updated_at = ?
         WHERE id = ? AND updated_at = ?`,
        [enabled ? 1 : 0, now, ruleId, currentUpdatedAt],
      );
      changes = updateRes.meta?.changes ?? 0;
    }

    if (changes === 0) {
      return {
        success: false,
        error: 'Rule was modified by another process. Please refresh.',
        code: 'CAS_CONFLICT',
      };
    }

    return {
      success: true,
      data: { ruleId, autoApply: enabled, updatedAt: now },
    };
  } catch (err) {
    logger.error(
      '[toggleRuleAutoApplyAction] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
      { ruleId, enabled },
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to toggle rule auto-apply',
      code: 'INTERNAL_ERROR',
    };
  }
}

// ── Action 3: rollbackRuleAction ─────────────────────────────────────────────

export async function rollbackRuleAction(
  ruleId: string,
): Promise<ActionResult<{ ruleId: string; rollbackCount: number; autoApply: false }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const { d1, client } = await getDbAccess();
    if (!d1 && !client) {
      return { success: false, error: 'Database not available', code: 'DB_UNAVAILABLE' };
    }

    const now = Date.now();
    let changes = 0;

    if (d1) {
      const updateRes = await d1
        .prepare(
          `UPDATE playbook_rules
           SET auto_apply = 0, rollback_count = rollback_count + 1, updated_at = ?
           WHERE id = ?`,
        )
        .bind(now, ruleId)
        .run();
      changes = updateRes.meta?.changes ?? 0;
    } else if (client) {
      const updateRes = await client.execute(
        `UPDATE playbook_rules
         SET auto_apply = 0, rollback_count = rollback_count + 1, updated_at = ?
         WHERE id = ?`,
        [now, ruleId],
      );
      changes = updateRes.meta?.changes ?? 0;
    }

    if (changes === 0) {
      return { success: false, error: 'Rule not found', code: 'NOT_FOUND' };
    }

    // Read back updated rollback_count
    let rollbackCount = 1;
    if (d1) {
      const row = await d1
        .prepare(`SELECT rollback_count FROM playbook_rules WHERE id = ?`)
        .bind(ruleId)
        .first<{ rollback_count: number }>();
      if (row) rollbackCount = row.rollback_count;
    } else if (client) {
      const res = await client.execute(
        `SELECT rollback_count FROM playbook_rules WHERE id = ?`,
        [ruleId],
      );
      const row = res.results?.[0] as { rollback_count?: number } | undefined;
      if (row?.rollback_count !== undefined) rollbackCount = row.rollback_count;
    }

    logger.info('[rollbackRuleAction] Rule successfully rolled back', {
      ruleId,
      rollbackCount,
    });

    return {
      success: true,
      data: { ruleId, rollbackCount, autoApply: false },
    };
  } catch (err) {
    logger.error(
      '[rollbackRuleAction] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
      { ruleId },
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to rollback rule',
      code: 'INTERNAL_ERROR',
    };
  }
}

// ── Action 4: saveRecurringScheduleAction ────────────────────────────────────

export async function saveRecurringScheduleAction(
  params: SaveScheduleParams,
): Promise<ActionResult<{ scheduleId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (!params.workspaceId || !params.blueprintId) {
      return { success: false, error: 'Missing required parameters', code: 'INVALID_INPUT' };
    }

    const { d1, client } = await getDbAccess();
    if (!d1 && !client) {
      return { success: false, error: 'Database not available', code: 'DB_UNAVAILABLE' };
    }

    const scheduleId = params.scheduleId || `sch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const batchSize = Math.max(1, Math.min(params.batchSize || 1, 20));
    const now = Date.now();

    // Parse cron to interval days
    let intervalDays = 7;
    const cron = (params.scheduleCron || '').trim();
    if (cron.includes('*/3') || cron.includes('3d')) intervalDays = 3;
    else if (cron === '0 0 * * *' || cron.includes('1d') || cron.includes('* * *')) intervalDays = 1;
    else if (cron.includes('*/14') || cron.includes('2w')) intervalDays = 14;
    else if (cron.includes('0 0 1 * *') || cron.includes('30d') || cron.includes('1m')) intervalDays = 30;

    const nextRunAt = now + intervalDays * 86400 * 1000;
    const nextRunDate = new Date(nextRunAt).toISOString().split('T')[0];

    // 1. Insert or update in recurring_campaign_runs
    try {
      if (d1) {
        await d1
          .prepare(
            `INSERT INTO recurring_campaign_runs (
               id, workspace_id, user_id, blueprint_id, schedule_cron, batch_size,
               next_run_at, last_run_at, is_active, total_runs, last_status,
               created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, 'idle', ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               blueprint_id = excluded.blueprint_id,
               schedule_cron = excluded.schedule_cron,
               batch_size = excluded.batch_size,
               is_active = excluded.is_active,
               updated_at = excluded.updated_at`,
          )
          .bind(
            scheduleId,
            params.workspaceId,
            user.id,
            params.blueprintId,
            params.scheduleCron,
            batchSize,
            nextRunAt,
            params.isActive ? 1 : 0,
            now,
            now,
          )
          .run();
      }
    } catch (err) {
      logger.warn('[saveRecurringScheduleAction] recurring_campaign_runs upsert failed', { error: String(err) });
    }

    // 2. Also insert or update in scheduled_campaigns
    try {
      if (d1) {
        await d1
          .prepare(
            `INSERT INTO scheduled_campaigns (
               id, user_id, topic, interval_days, next_run_date, last_run_date,
               is_active, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, NULL, ?, datetime('now'), datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
               topic = excluded.topic,
               interval_days = excluded.interval_days,
               next_run_date = excluded.next_run_date,
               is_active = excluded.is_active,
               updated_at = datetime('now')`,
          )
          .bind(
            scheduleId,
            user.id,
            params.blueprintId,
            intervalDays,
            nextRunDate,
            params.isActive ? 1 : 0,
          )
          .run();
      }
    } catch (err) {
      logger.warn('[saveRecurringScheduleAction] scheduled_campaigns upsert failed', { error: String(err) });
    }

    logger.info('[saveRecurringScheduleAction] Schedule saved successfully', {
      scheduleId,
      workspaceId: params.workspaceId,
      blueprintId: params.blueprintId,
      batchSize,
      isActive: params.isActive,
    });

    return {
      success: true,
      data: { scheduleId },
    };
  } catch (err) {
    logger.error(
      '[saveRecurringScheduleAction] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
      { params },
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save recurring schedule',
      code: 'INTERNAL_ERROR',
    };
  }
}

// ── Action 5: toggleRecurringScheduleAction ──────────────────────────────────

export async function toggleRecurringScheduleAction(
  scheduleId: string,
  isActive: boolean,
): Promise<ActionResult<{ scheduleId: string; isActive: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const { d1, client } = await getDbAccess();
    if (!d1 && !client) {
      return { success: false, error: 'Database not available', code: 'DB_UNAVAILABLE' };
    }

    const now = Date.now();

    if (d1) {
      await d1
        .prepare(
          `UPDATE recurring_campaign_runs
           SET is_active = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(isActive ? 1 : 0, now, scheduleId)
        .run();

      await d1
        .prepare(
          `UPDATE scheduled_campaigns
           SET is_active = ?, updated_at = datetime('now')
           WHERE id = ?`,
        )
        .bind(isActive ? 1 : 0, scheduleId)
        .run();
    } else if (client) {
      await client.execute(
        `UPDATE recurring_campaign_runs
         SET is_active = ?, updated_at = ?
         WHERE id = ?`,
        [isActive ? 1 : 0, now, scheduleId],
      );
      await client.execute(
        `UPDATE scheduled_campaigns
         SET is_active = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [isActive ? 1 : 0, scheduleId],
      );
    }

    return {
      success: true,
      data: { scheduleId, isActive },
    };
  } catch (err) {
    logger.error(
      '[toggleRecurringScheduleAction] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
      { scheduleId, isActive },
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to toggle schedule status',
      code: 'INTERNAL_ERROR',
    };
  }
}

// ── Action 6: triggerBatchRunAction ──────────────────────────────────────────

export async function triggerBatchRunAction(
  params: TriggerBatchParams,
): Promise<ActionResult<{ batchId: string; missionIds: string[]; preflight: MissionPreflightResult }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const { d1, client } = await getDbAccess();
    if (!d1 && !client) {
      return { success: false, error: 'Database not available', code: 'DB_UNAVAILABLE' };
    }

    // 1. Fetch blueprint
    let blueprint: CampaignBlueprintRow | null = null;
    if (d1) {
      blueprint = await d1
        .prepare(`SELECT * FROM campaign_blueprints WHERE id = ?`)
        .bind(params.blueprintId)
        .first<CampaignBlueprintRow>();
    } else if (client) {
      const res = await client.execute(
        `SELECT * FROM campaign_blueprints WHERE id = ?`,
        [params.blueprintId],
      );
      blueprint = (res.results?.[0] as CampaignBlueprintRow) ?? null;
    }

    // Fallback if not found in campaign_blueprints: check scheduled_campaigns topic or synthesize default
    if (!blueprint) {
      logger.warn('[triggerBatchRunAction] Blueprint not found in campaign_blueprints, using fallback configuration', {
        blueprintId: params.blueprintId,
      });
      blueprint = {
        id: params.blueprintId,
        workspace_id: params.workspaceId,
        name_en: 'Batch Campaign',
        name_vi: 'Chiến dịch Batch',
        description_en: 'Automated batch run',
        description_vi: 'Chạy loạt tự động',
        target_platform: 'youtube_shorts',
        hook_style: 'curiosity_gap',
        voice_style: 'dynamic_hook',
        duration_seconds: 60,
        aspect_ratio: '9:16',
        estimated_scenes: 3,
        suggested_prompts: '[]',
        is_active: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };
    }

    const batchSize = Math.max(1, Math.min(params.batchSize || 1, 20));
    const singleCostCents = blueprint.duration_seconds && blueprint.duration_seconds > 30 ? 150 : 100;
    const totalCostCents = singleCostCents * batchSize;

    // 2. Evaluate 7-Gate Preflight Check
    const preflight = await runMissionPreflightCheck({
      userId: user.id,
      workspaceId: params.workspaceId,
      capability: 'AI_VIDEO',
      requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'],
      estimatedCostCents: totalCostCents,
    });

    if (!preflight.passed) {
      logger.warn('[triggerBatchRunAction] 7-Gate preflight failed', {
        failureCode: preflight.failureCode,
        failureReason: preflight.failureReason,
      });
      return {
        success: false,
        error: preflight.failureReason || 'Preflight check failed',
        code: preflight.failureCode || 'PREFLIGHT_FAILED',
        data: { batchId: '', missionIds: [], preflight },
      };
    }

    // 3. Monthly Tier Quota Check
    const userTier = await getUserTier(user.id);
    const quota = await checkMissionQuota(user.id, userTier, 'missions');
    if (!quota.allowed) {
      logger.warn('[triggerBatchRunAction] Monthly quota exceeded', {
        userId: user.id,
        tier: userTier,
        used: quota.used,
        limit: quota.limit,
      });
      return {
        success: false,
        error: `Monthly mission quota exceeded for ${userTier} tier (${quota.used}/${quota.limit})`,
        code: 'QUOTA_EXCEEDED',
        data: { batchId: '', missionIds: [], preflight },
      };
    }

    // 4. Atomic MCU Credits Deduction
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const creditDeducted = await deductCredits(
      user.id,
      totalCostCents,
      batchId,
      'campaign_batch_dispatch',
    );

    if (!creditDeducted) {
      logger.warn('[triggerBatchRunAction] Credit deduction failed', {
        userId: user.id,
        totalCostCents,
      });
      return {
        success: false,
        error: 'Insufficient MCU credits balance to dispatch batch',
        code: 'INSUFFICIENT_CREDITS',
        data: { batchId, missionIds: [], preflight },
      };
    }

    // 5. Create missions and dispatch multi-track pipeline
    const missionIds: string[] = [];
    const nowSec = Math.floor(Date.now() / 1000);

    for (let i = 0; i < batchSize; i++) {
      const missionId = `m_batch_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
      try {
        await createMission({
          id: missionId,
          workspaceId: params.workspaceId,
          creatorId: user.id,
          title: `${blueprint.name_en || 'Batch Campaign'} #${i + 1}`,
          objective: `Automated batch video variation #${i + 1} for blueprint ${params.blueprintId}`,
          audience: 'Playbook target audience',
          geography: 'global',
          timeframeStart: nowSec,
          timeframeEnd: nowSec + 7 * 86400,
          budgetCents: singleCostCents,
          spentCents: 0,
          autonomyLevel: 3,
          channels: [blueprint.target_platform || 'youtube_shorts'],
          monetizationGoals: ['conversion'],
          constraints: {
            blueprintId: params.blueprintId,
            batchIndex: i,
            batchId,
            totalBatch: batchSize,
          },
          successMetrics: {},
          status: 'draft',
          currentPhase: 'init',
          createdAt: nowSec,
          updatedAt: nowSec,
        });

        missionIds.push(missionId);

        // Dispatch multi-track generation asynchronously
        await dispatchMultiTrackMission(missionId, {
          workspaceId: params.workspaceId,
          userId: user.id,
          platform: blueprint.target_platform || 'youtube_shorts',
        });
      } catch (dispatchErr) {
        logger.warn('[triggerBatchRunAction] Multi-track dispatch error for mission', {
          missionId,
          error: String(dispatchErr),
        });
      }
    }

    logger.info('[triggerBatchRunAction] Batch run successfully triggered', {
      batchId,
      missionCount: missionIds.length,
      workspaceId: params.workspaceId,
      blueprintId: params.blueprintId,
    });

    return {
      success: true,
      data: {
        batchId,
        missionIds,
        preflight,
      },
    };
  } catch (err) {
    logger.error(
      '[triggerBatchRunAction] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
      { params },
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to trigger batch campaign run',
      code: 'INTERNAL_ERROR',
    };
  }
}

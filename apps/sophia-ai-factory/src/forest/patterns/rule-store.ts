/**
 * Rule Store — Phase 5: Auto-Creative Playbook (COMPOUND stage)
 *
 * Read/write playbook rules to D1. Rules are idempotent per rule id.
 *
 * Layer: forest (infrastructure orchestrator)
 */

import { createServerClient } from '@/seed/db/client'
import type { PlaybookRule, PlaybookRuleRow } from '@/seed/types/playbook-pattern'

/** Insert or replace a playbook rule. */
export async function upsertRule(r: PlaybookRule): Promise<void> {
  const db = createServerClient()
  await db.execute(
    `INSERT INTO playbook_rules
       (id, workspace_id, pattern_id, platform, goal, rule_vi, rule_en,
        confidence, sample_size, applied_count, auto_apply, rollback_count,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id)
     DO UPDATE SET applied_count = excluded.applied_count,
                   auto_apply = excluded.auto_apply,
                   rollback_count = excluded.rollback_count,
                   updated_at = excluded.updated_at`,
    [
      r.id, r.workspaceId, r.patternId, r.platform, r.goal,
      r.ruleVi, r.ruleEn, r.confidence, r.sampleSize,
      r.appliedCount, r.autoApply ? 1 : 0, r.rollbackCount,
      r.createdAt, r.updatedAt,
    ],
  )
}

/** List rules for a workspace, optionally filtered to auto-apply eligible. */
export async function listRules(
  workspaceId: string,
  autoApplyOnly = false,
): Promise<PlaybookRule[]> {
  const db = createServerClient()
  const sql = autoApplyOnly
    ? `SELECT * FROM playbook_rules
       WHERE workspace_id = ? AND auto_apply = 1
       ORDER BY confidence DESC, created_at DESC`
    : `SELECT * FROM playbook_rules
       WHERE workspace_id = ?
       ORDER BY confidence DESC, created_at DESC`
  const result = await db.execute(sql, [workspaceId])
  return ((result.results ?? []) as PlaybookRuleRow[]).map(rowToRule)
}

/** Increment rollback_count after an auto-rollback. */
export async function recordRollback(ruleId: string): Promise<void> {
  const db = createServerClient()
  await db.execute(
    `UPDATE playbook_rules SET rollback_count = rollback_count + 1, updated_at = ?
     WHERE id = ?`,
    [Date.now(), ruleId],
  )
}

function rowToRule(r: PlaybookRuleRow): PlaybookRule {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    patternId: r.pattern_id,
    platform: r.platform,
    goal: r.goal,
    ruleVi: r.rule_vi,
    ruleEn: r.rule_en,
    confidence: r.confidence,
    sampleSize: r.sample_size,
    appliedCount: r.applied_count,
    autoApply: r.auto_apply === 1,
    rollbackCount: r.rollback_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}
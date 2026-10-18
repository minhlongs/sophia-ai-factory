/**
 * Database rollback executor helper for Playbook Rules.
 *
 * Layer: land (business workflows / Server Actions)
 *
 * @module land/playbook/actions/rule-rollback-helper
 */

import type { D1Client, D1Database } from '@/seed/db/client';

export async function executeRuleRollbackUpdate(
  d1: D1Database | null,
  client: D1Client | null,
  ruleId: string,
  now: number,
): Promise<{ changes: number; rollbackCount: number }> {
  let changes = 0;

  if (d1) {
    const updateRes = await d1
      .prepare(
        `UPDATE playbook_rules SET auto_apply = 0, rollback_count = rollback_count + 1, updated_at = ? WHERE id = ?`,
      )
      .bind(now, ruleId)
      .run();
    changes = updateRes.meta?.changes ?? 0;
  } else if (client) {
    const updateRes = await client.execute(
      `UPDATE playbook_rules SET auto_apply = 0, rollback_count = rollback_count + 1, updated_at = ? WHERE id = ?`,
      [now, ruleId],
    );
    changes = updateRes.meta?.changes ?? 0;
  }

  if (changes === 0) {
    return { changes: 0, rollbackCount: 0 };
  }

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

  return { changes, rollbackCount };
}

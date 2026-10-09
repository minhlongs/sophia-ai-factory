/**
 * Database update executor helper for Playbook Rules.
 *
 * Layer: land (business workflows / Server Actions)
 *
 * @module land/playbook/actions/rule-db-helper
 */

import type { D1Client, D1Database } from '@/seed/db/client';

export async function executeRuleCasUpdate(
  d1: D1Database | null,
  client: D1Client | null,
  ruleId: string,
  enabled: boolean,
  updatedAt: number,
  expectedUpdatedAt: number,
): Promise<number> {
  if (d1) {
    const res = await d1
      .prepare(
        `UPDATE playbook_rules SET auto_apply = ?, updated_at = ? WHERE id = ? AND updated_at = ?`,
      )
      .bind(enabled ? 1 : 0, updatedAt, ruleId, expectedUpdatedAt)
      .run();
    return res.meta?.changes ?? 0;
  }
  if (client) {
    const res = await client.execute(
      `UPDATE playbook_rules SET auto_apply = ?, updated_at = ? WHERE id = ? AND updated_at = ?`,
      [enabled ? 1 : 0, updatedAt, ruleId, expectedUpdatedAt],
    );
    return res.meta?.changes ?? 0;
  }
  return 0;
}

export async function fetchCurrentRuleUpdatedAt(
  d1: D1Database | null,
  client: D1Client | null,
  ruleId: string,
): Promise<number | undefined> {
  if (d1) {
    const row = await d1
      .prepare(`SELECT updated_at FROM playbook_rules WHERE id = ?`)
      .bind(ruleId)
      .first<{ updated_at: number }>();
    return row?.updated_at;
  }
  if (client) {
    const res = await client.execute(
      `SELECT updated_at FROM playbook_rules WHERE id = ?`,
      [ruleId],
    );
    const row = res.results?.[0] as { updated_at?: number } | undefined;
    return row?.updated_at;
  }
  return undefined;
}

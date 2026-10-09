/**
 * Playbook Rule Actions (OCC CAS & Rollback).
 *
 * Layer: land (business workflows / Server Actions)
 * STRICT 4-LAYER BOUNDARY: imports only from @/seed and @/tree.
 *
 * @module land/playbook/actions/rule-actions
 */

'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import type { ActionResult } from './types';
import { getDbAccess } from './db-access';
import { executeRuleCasUpdate, fetchCurrentRuleUpdatedAt } from './rule-db-helper';

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
    let targetExpected = expectedUpdatedAt;

    if (typeof targetExpected !== 'number') {
      targetExpected = await fetchCurrentRuleUpdatedAt(d1, client, ruleId);
      if (targetExpected === undefined) {
        return { success: false, error: 'Rule not found', code: 'NOT_FOUND' };
      }
    }

    const changes = await executeRuleCasUpdate(d1, client, ruleId, enabled, now, targetExpected);
    if (changes === 0) {
      logger.warn('[toggleRuleAutoApplyAction] OCC CAS conflict detected', {
        ruleId,
        expectedUpdatedAt: targetExpected,
      });
      return {
        success: false,
        error: 'Rule was modified by another process. Please refresh.',
        code: 'CAS_CONFLICT',
      };
    }

    revalidatePath('/dashboard/playbook');
    revalidatePath('/[locale]/dashboard/playbook');
    revalidateTag('playbook_rules', 'max');
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
        .prepare(`UPDATE playbook_rules SET auto_apply = 0, rollback_count = rollback_count + 1, updated_at = ? WHERE id = ?`)
        .bind(now, ruleId).run();
      changes = updateRes.meta?.changes ?? 0;
    } else if (client) {
      const updateRes = await client.execute(
        `UPDATE playbook_rules SET auto_apply = 0, rollback_count = rollback_count + 1, updated_at = ? WHERE id = ?`,
        [now, ruleId],
      );
      changes = updateRes.meta?.changes ?? 0;
    }

    if (changes === 0) {
      return { success: false, error: 'Rule not found', code: 'NOT_FOUND' };
    }

    let rollbackCount = 1;
    if (d1) {
      const row = await d1
        .prepare(`SELECT rollback_count FROM playbook_rules WHERE id = ?`)
        .bind(ruleId).first<{ rollback_count: number }>();
      if (row) rollbackCount = row.rollback_count;
    } else if (client) {
      const res = await client.execute(`SELECT rollback_count FROM playbook_rules WHERE id = ?`, [ruleId]);
      const row = res.results?.[0] as { rollback_count?: number } | undefined;
      if (row?.rollback_count !== undefined) rollbackCount = row.rollback_count;
    }

    logger.info('[rollbackRuleAction] Rule successfully rolled back', { ruleId, rollbackCount });
    revalidatePath('/dashboard/playbook');
    revalidatePath('/[locale]/dashboard/playbook');
    revalidateTag('playbook_rules', 'max');
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

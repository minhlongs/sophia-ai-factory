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
import { executeRuleRollbackUpdate } from './rule-rollback-helper';

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
    const { changes, rollbackCount } = await executeRuleRollbackUpdate(d1, client, ruleId, now);

    if (changes === 0) {
      return { success: false, error: 'Rule not found', code: 'NOT_FOUND' };
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

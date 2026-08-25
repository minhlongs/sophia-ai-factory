/**
 * Server Action: Get latest creative memory entries for a workspace.
 *
 * Reads creative_memory table (created_at = MILLISECONDS).
 * Returns latest 5 entries by updated_at descending.
 *
 * Timestamp discipline: creative_memory.created_at / updated_at = MILLISECONDS.
 *
 * @module land/creative-economy/memory-insights
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { MemoryInsight, DashboardResult } from './types';

const schema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  limit: z.number().min(1).max(20).default(5),
});

/**
 * Get latest creative memory entries for a workspace.
 * Returns title, summary, category, confidence, createdAtMs.
 */
export async function getCreativeMemory(
  input: z.input<typeof schema>
): Promise<DashboardResult<MemoryInsight[]>> {
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

    const rows = await db
      .prepare(
        `SELECT id, category, key, value, confidence, created_at
         FROM creative_memory
         WHERE workspace_id = ?1
           AND is_deleted = 0
         ORDER BY updated_at DESC
         LIMIT ?2`,
      )
      .bind(parsed.data.workspaceId, parsed.data.limit)
      .all<{
        id: string;
        category: string;
        key: string;
        value: string;
        confidence: string;
        created_at: number;
      }>();

    const insights = (rows.results ?? []).map((r) => {
      let summary = '';
      let title = r.key;
      try {
        const val = JSON.parse(r.value);
        if (typeof val === 'object' && val !== null) {
          if (val.summary) summary = String(val.summary);
          if (val.title) title = String(val.title);
          if (!summary) summary = JSON.stringify(val).slice(0, 200);
        } else {
          summary = String(val).slice(0, 200);
        }
      } catch {
        summary = r.value.slice(0, 200);
      }

      return {
        id: r.id,
        category: r.category,
        key: r.key,
        title,
        summary,
        confidence: r.confidence,
        createdAtMs: r.created_at,
      };
    });

    return success(insights);
  } catch (err) {
    const error = toError(err);
    logger.error('[CreativeEconomy] getCreativeMemory failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}
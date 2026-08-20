/**
 * Handler: analytics:report
 *
 * Queries engine_missions table to produce usage stats for the user.
 * LIVE — no external API call. Uses raw D1 SQL for aggregations.
 */

import { getBalance } from '@/tree/mcu/credits-repo';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionHandlerResult, MissionContext } from '@/forest/missions/types';

interface D1Env {
  __env?: { DB?: D1Database };
  __D1_DB?: D1Database;
}

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as D1Env).__env;
    if (env?.DB) return env.DB;
    return (globalThis as unknown as D1Env).__D1_DB ?? null;
  } catch {
    return null;
  }
}

interface CommandStatRow {
  command: string;
  count: number;
  total_credits: number;
}

interface StatusCountRow {
  status: string;
  count: number;
}

interface RecentMissionRow {
  id: string;
  command: string;
  status: string;
  credits_used: number;
  created_at: number;
}

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { userId } = ctx;

  const balance = await getBalance(userId);
  const d1 = await getD1();

  if (!d1) {
    return {
      ok: true,
      data: {
        credits: balance,
        missions_by_command: [],
        missions_by_status: [],
        recent_missions: [],
        generated_at: Math.floor(Date.now() / 1000),
        note: 'D1 binding unavailable for aggregations',
      },
    };
  }

  try {
    const [byCommandResult, byStatusResult, recentResult] = await Promise.all([
      d1.prepare(
        `SELECT command, COUNT(*) as count, SUM(credits_used) as total_credits
         FROM engine_missions WHERE user_id = ? GROUP BY command`
      ).bind(userId).all<CommandStatRow>(),

      d1.prepare(
        `SELECT status, COUNT(*) as count
         FROM engine_missions WHERE user_id = ? GROUP BY status`
      ).bind(userId).all<StatusCountRow>(),

      d1.prepare(
        `SELECT id, command, status, credits_used, created_at
         FROM engine_missions WHERE user_id = ?
         ORDER BY created_at DESC LIMIT 5`
      ).bind(userId).all<RecentMissionRow>(),
    ]);

    return {
      ok: true,
      data: {
        credits: balance,
        missions_by_command: byCommandResult.results,
        missions_by_status: byStatusResult.results,
        recent_missions: recentResult.results,
        generated_at: Math.floor(Date.now() / 1000),
      },
    };
  } catch (err) {
    logger.error('[analytics:report] Query error', err instanceof Error ? err : new Error(String(err)));
    return {
      ok: true,
      data: {
        credits: balance,
        missions_by_command: [],
        missions_by_status: [],
        recent_missions: [],
        generated_at: Math.floor(Date.now() / 1000),
        error: 'Aggregation query failed',
      },
    };
  }
}

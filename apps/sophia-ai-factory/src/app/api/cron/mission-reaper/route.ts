/** Atomically fail stale missions and reverse only their server-bound MCU charge. */
import { NextRequest, NextResponse } from 'next/server';
import type { D1Database } from '@cloudflare/workers-types';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { logger } from '@/seed/utils/logger-utility';
import { getD1Safe } from '@/seed/db/client';

export const dynamic = 'force-dynamic';

const STUCK_THRESHOLD_SECONDS = 15 * 60;

interface StuckMission {
  id: string;
  user_id: string;
}

interface Compensation {
  outcome: 'compensated' | 'legacy_unproven' | 'no_debit';
  restored: number;
}

function compensateMission(db: D1Database, mission: StuckMission) {
  // The claim's trigger applies the wallet, grants, ledger and mission status in
  // this statement. If any write fails, the mission stays eligible for retry.
  return db.prepare(`INSERT INTO mcu_mission_compensations
    (id,mission_id,debit_id,user_id,org_id,outcome,amount,purchased,pilot_restored,pilot_withheld)
    SELECT ?,m.id,s.debit_id,m.user_id,s.org_id,
      CASE WHEN s.debit_id IS NOT NULL THEN 'compensated'
        WHEN m.status='running' OR m.credits_used>0 THEN 'legacy_unproven' ELSE 'no_debit' END,
      COALESCE(s.amount,0),COALESCE(s.purchased,0),COALESCE(s.pilot_restored,0),COALESCE(s.pilot_withheld,0)
    FROM engine_missions m LEFT JOIN mcu_mission_compensation_sources s ON s.mission_id=m.id
    WHERE m.id=? AND m.user_id=? AND m.status IN ('pending','running') AND m.created_at<strftime('%s','now')-?
    ON CONFLICT(mission_id) DO NOTHING
    RETURNING outcome,purchased+pilot_restored AS restored`)
    .bind(crypto.randomUUID(), mission.id, mission.user_id, STUCK_THRESHOLD_SECONDS).first<Compensation>();
}

async function compensateStuckMissions(db: D1Database, stuckMissions: StuckMission[]) {
  let reaped = 0;
  let refunded = 0;
  let failed = 0;
  let unreconciled = 0;
  for (const mission of stuckMissions) {
    try {
      const result = await compensateMission(db, mission);
      if (!result) continue;
      reaped++;
      refunded += result.restored;
      if (result.outcome === 'legacy_unproven') {
        unreconciled++;
        logger.warn('[cron/mission-reaper] No trusted charge; manual MCU reconciliation required', { missionId: mission.id });
      }
    } catch (err) {
      failed++;
      logger.error('[cron/mission-reaper] Failed to reap mission; remains retryable', {
        missionId: mission.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { reaped, refunded, failed, unreconciled };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const db = await getD1Safe();
  if (!db) {
    logger.error('[cron/mission-reaper] D1 binding unavailable');
    return NextResponse.json({ error: 'D1 binding unavailable' }, { status: 503 });
  }

  let stuckMissions: StuckMission[];
  try {
    const { results } = await db.prepare(`SELECT id,user_id FROM engine_missions
      WHERE status IN ('pending','running') AND created_at<strftime('%s','now')-?`)
      .bind(STUCK_THRESHOLD_SECONDS).all<StuckMission>();
    stuckMissions = results;
  } catch (err) {
    logger.error('[cron/mission-reaper] Failed to query stuck missions', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Failed to query stuck missions' }, { status: 500 });
  }

  if (stuckMissions.length === 0) return NextResponse.json({ ok: true, reaped: 0 });

  const { reaped, refunded, failed, unreconciled } = await compensateStuckMissions(db, stuckMissions);

  logger.info('[cron/mission-reaper] Done', { reaped, refunded, failed, unreconciled });
  return NextResponse.json({
    ok: failed === 0, reaped, credits_refunded: refunded,
    ...(unreconciled > 0 ? { unreconciled } : {}),
    ...(failed > 0 ? { failed } : {}),
  }, { status: failed > 0 ? 500 : 200 });
}

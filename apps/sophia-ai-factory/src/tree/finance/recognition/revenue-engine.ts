/**
 * Ratable Daily Accrual Processing Engine
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/finance/recognition/revenue-engine
 */

import type { D1Database } from '@/seed/db/client';
import type { AccrualRunResult, ScheduleStatus } from '@/seed/types/financial-close';
import { parseDateIso, type RawScheduleRow } from './types';
import { mapRowToRevenueSchedule } from './compliance-audit';

/**
 * Process ratable daily accruals up to the given asOfDate across all active schedules.
 * Enforces Zero Penny Leakage: on or past the final day, recognizes all remaining deferred cents.
 */
export async function processDailyAccrual(
  db: D1Database,
  asOfDate: string,
): Promise<AccrualRunResult> {
  const { results } = await db
    .prepare(
      `SELECT * FROM revenue_schedules
       WHERE status = 'active'
         AND start_date <= ?1
         AND (last_accrual_date IS NULL OR last_accrual_date < ?1)`
    )
    .bind(asOfDate)
    .all<RawScheduleRow>();

  const activeSchedules = (results ?? []).map(mapRowToRevenueSchedule);

  let schedulesAccrued = 0;
  let totalAccruedCents = 0;
  let invarianceViolations = 0;
  let completedCount = 0;
  const now = Date.now();

  for (const schedule of activeSchedules) {
    // Calculate elapsed days from start_date to asOfDate (inclusive of start date: day 1 on start date)
    const start = parseDateIso(schedule.startDate);
    const target = parseDateIso(asOfDate);
    const msDiff = target.getTime() - start.getTime();
    if (msDiff < 0) {
      continue; // Not yet started
    }

    const elapsedDays = Math.floor(msDiff / (1000 * 60 * 60 * 24)) + 1;
    const effectiveDays = Math.min(schedule.termDays, elapsedDays);

    let targetRecognizedCents = 0;
    let targetDeferredCents = 0;
    let nextStatus: ScheduleStatus = 'active';

    if (effectiveDays >= schedule.termDays) {
      // Completed schedule: zero penny leakage guarantee
      targetRecognizedCents = schedule.totalContractValueCents;
      targetDeferredCents = 0;
      nextStatus = 'completed';
      completedCount++;
    } else {
      // Ratable straight-line accrual
      targetRecognizedCents = Math.min(
        schedule.totalContractValueCents,
        Math.round(effectiveDays * (schedule.totalContractValueCents / schedule.termDays))
      );
      targetDeferredCents = schedule.totalContractValueCents - targetRecognizedCents;
    }

    const deltaCents = targetRecognizedCents - schedule.recognizedRevenueCents;
    if (deltaCents > 0) {
      totalAccruedCents += deltaCents;
      schedulesAccrued++;
    }

    // Invariance verification
    if (targetRecognizedCents + targetDeferredCents !== schedule.totalContractValueCents) {
      invarianceViolations++;
      throw new Error(
        `Invariant failure in schedule ${schedule.id}: total ${schedule.totalContractValueCents} != ${targetRecognizedCents} + ${targetDeferredCents}`
      );
    }

    await db
      .prepare(
        `UPDATE revenue_schedules
         SET recognized_revenue_cents = ?1,
             deferred_revenue_cents = ?2,
             days_recognized = ?3,
             status = ?4,
             last_accrual_date = ?5,
             updated_at = ?6
         WHERE id = ?7`
      )
      .bind(
        targetRecognizedCents,
        targetDeferredCents,
        effectiveDays,
        nextStatus,
        asOfDate,
        now,
        schedule.id,
      )
      .run();
  }

  return {
    asOfDate,
    schedulesEvaluated: activeSchedules.length,
    schedulesAccrued,
    totalAccruedCents,
    invarianceViolationsCount: invarianceViolations,
    completedSchedulesCount: completedCount,
  };
}

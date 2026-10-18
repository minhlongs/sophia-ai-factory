/**
 * MCU Velocity & Exhaustion Risk Calculator.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/analytics/mcu-velocity
 */

import type { McuLogRecord, McuVelocityResult } from './types';
import {
  calculateConsumptionWindows,
  determineRunwayAndRisk,
  parseMcuLogRecord,
  parseMcuLogs,
  type ParsedLog,
} from './mcu-velocity-helpers';

export {
  calculateConsumptionWindows,
  determineRunwayAndRisk,
  parseMcuLogRecord,
  parseMcuLogs,
  type ParsedLog,
};

/**
 * Calculates rolling 7-day and 30-day MCU consumption velocity, acceleration,
 * and estimated runway days remaining.
 *
 * @param consumptionLogs Array of MCU consumption log records
 * @param windowDays Window size in days (defaults to 30)
 * @param currentBalance Current remaining MCU balance of the client/pool
 * @param referenceTimestamp Optional reference timestamp in ms (defaults to now or max log time)
 * @returns McuVelocityResult
 */
export function calculateMcuVelocity(
  consumptionLogs: McuLogRecord[],
  windowDays = 30,
  currentBalance = 0,
  referenceTimestamp?: number,
): McuVelocityResult {
  const safeBalance = Math.max(0, currentBalance);
  const safeWindowDays = Math.max(1, windowDays);

  if (!consumptionLogs || consumptionLogs.length === 0) {
    return {
      velocity7d: 0,
      velocity30d: 0,
      velocityWindowDays: 0,
      totalConsumedInWindow: 0,
      totalConsumedLifetime: 0,
      acceleration: 0,
      trend: 'stable',
      currentBalance: safeBalance,
      runwayDays: 999,
      exhaustionRisk: 'dormant',
    };
  }

  const { parsedLogs, maxLogTs, totalConsumedLifetime } = parseMcuLogs(consumptionLogs);
  const anchorTime = referenceTimestamp ?? Math.max(Date.now(), maxLogTs);
  const { consumed7d, consumed30d, consumedWindow } = calculateConsumptionWindows(
    parsedLogs,
    anchorTime,
    safeWindowDays,
  );

  const velocity7d = Number((consumed7d / 7).toFixed(2));
  const velocity30d = Number((consumed30d / 30).toFixed(2));
  const velocityWindowDays = Number((consumedWindow / safeWindowDays).toFixed(2));

  const EPSILON = 0.001;
  const rawAcceleration = (velocity7d - velocity30d) / (velocity30d + EPSILON);
  const acceleration = Number(rawAcceleration.toFixed(3));

  let trend: 'accelerating' | 'decelerating' | 'stable' = 'stable';
  if (acceleration > 0.25) {
    trend = 'accelerating';
  } else if (acceleration < -0.25) {
    trend = 'decelerating';
  }

  const { runwayDays, exhaustionRisk } = determineRunwayAndRisk(velocity7d, velocity30d, safeBalance);

  return {
    velocity7d,
    velocity30d,
    velocityWindowDays,
    totalConsumedInWindow: consumedWindow,
    totalConsumedLifetime,
    acceleration,
    trend,
    currentBalance: safeBalance,
    runwayDays,
    exhaustionRisk,
  };
}

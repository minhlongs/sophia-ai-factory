/**
 * MCU Velocity & Exhaustion Risk Calculator.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/analytics/mcu-velocity
 */

import type { McuLogRecord, McuVelocityResult } from './types';

interface ParsedLog {
  timestamp: number;
  consumed: number;
}

function parseMcuLogRecord(log: McuLogRecord): { ts: number; consumed: number } {
  let ts = typeof log.timestamp === 'string'
    ? new Date(log.timestamp).getTime()
    : log.timestamp;
  if (Number.isNaN(ts)) {
    ts = Date.now();
  }
  let consumed = 0;
  if (log.mcuConsumed !== undefined) {
    consumed = Math.max(0, log.mcuConsumed);
  } else if (log.delta !== undefined && log.delta < 0) {
    consumed = Math.abs(log.delta);
  }
  return { ts, consumed };
}

function parseMcuLogs(consumptionLogs: McuLogRecord[]): {
  parsedLogs: ParsedLog[];
  maxLogTs: number;
  totalConsumedLifetime: number;
} {
  const parsedLogs: ParsedLog[] = [];
  let maxLogTs = 0;
  let totalConsumedLifetime = 0;

  for (const log of consumptionLogs) {
    const { ts, consumed } = parseMcuLogRecord(log);
    if (ts > maxLogTs) {
      maxLogTs = ts;
    }
    totalConsumedLifetime += consumed;
    parsedLogs.push({ timestamp: ts, consumed });
  }

  return { parsedLogs, maxLogTs, totalConsumedLifetime };
}

function calculateConsumptionWindows(
  parsedLogs: ParsedLog[],
  anchorTime: number,
  safeWindowDays: number,
): { consumed7d: number; consumed30d: number; consumedWindow: number } {
  const MS_PER_DAY = 86_400 * 1000;
  let consumed7d = 0;
  let consumed30d = 0;
  let consumedWindow = 0;

  for (const p of parsedLogs) {
    const elapsedMs = anchorTime - p.timestamp;
    if (elapsedMs >= 0 && elapsedMs < 7 * MS_PER_DAY) {
      consumed7d += p.consumed;
    }
    if (elapsedMs >= 0 && elapsedMs < 30 * MS_PER_DAY) {
      consumed30d += p.consumed;
    }
    if (elapsedMs >= 0 && elapsedMs < safeWindowDays * MS_PER_DAY) {
      consumedWindow += p.consumed;
    }
  }

  return { consumed7d, consumed30d, consumedWindow };
}

function determineRunwayAndRisk(
  velocity7d: number,
  velocity30d: number,
  safeBalance: number,
): { runwayDays: number; exhaustionRisk: 'imminent' | 'warning' | 'healthy' | 'dormant' } {
  let runwayDays = 999;
  if (velocity7d > 0) {
    runwayDays = Math.floor(safeBalance / velocity7d);
  } else if (velocity30d > 0) {
    runwayDays = Math.floor(safeBalance / velocity30d);
  }

  let exhaustionRisk: 'imminent' | 'warning' | 'healthy' | 'dormant' = 'healthy';
  if (velocity7d === 0 && velocity30d === 0) {
    exhaustionRisk = 'dormant';
  } else if (runwayDays < 7) {
    exhaustionRisk = 'imminent';
  } else if (runwayDays < 15) {
    exhaustionRisk = 'warning';
  }

  return { runwayDays, exhaustionRisk };
}

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

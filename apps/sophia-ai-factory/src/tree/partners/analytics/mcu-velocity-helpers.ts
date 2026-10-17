/**
 * MCU Velocity Parsing, Rolling Window & Runway Calculation Helpers
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/analytics/mcu-velocity-helpers
 */

import type { McuLogRecord } from './types';

export interface ParsedLog {
  timestamp: number;
  consumed: number;
}

export function parseMcuLogRecord(log: McuLogRecord): { ts: number; consumed: number } {
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

export function parseMcuLogs(consumptionLogs: McuLogRecord[]): {
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

export function calculateConsumptionWindows(
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

export function determineRunwayAndRisk(
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

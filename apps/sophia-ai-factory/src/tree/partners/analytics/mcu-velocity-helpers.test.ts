import { describe, expect, it, vi } from 'vitest';
import {
  calculateConsumptionWindows,
  determineRunwayAndRisk,
  parseMcuLogRecord,
  parseMcuLogs,
} from './mcu-velocity-helpers';

describe('MCU velocity helpers', () => {
  it('parses explicit consumption, negative deltas, and malformed timestamps', () => {
    expect(parseMcuLogRecord({ timestamp: 1000, mcuConsumed: 12, delta: -4 })).toEqual({ ts: 1000, consumed: 12 });
    expect(parseMcuLogRecord({ timestamp: 1000, delta: -4 })).toEqual({ ts: 1000, consumed: 4 });
    expect(parseMcuLogRecord({ timestamp: 1000, mcuConsumed: -2 })).toEqual({ ts: 1000, consumed: 0 });
    const now = vi.spyOn(Date, 'now').mockReturnValue(2000);
    expect(parseMcuLogRecord({ timestamp: 'invalid', delta: 5 })).toEqual({ ts: 2000, consumed: 0 });
    now.mockRestore();
    expect(parseMcuLogRecord({ timestamp: new Date(3000).toISOString() })).toEqual({ ts: 3000, consumed: 0 });
  });

  it('aggregates lifetime consumption and rolling windows', () => {
    const day = 86_400_000;
    const { parsedLogs, maxLogTs, totalConsumedLifetime } = parseMcuLogs([
      { timestamp: 100 * day, mcuConsumed: 5 },
      { timestamp: 80 * day, delta: -7 },
    ]);
    expect(maxLogTs).toBe(100 * day);
    expect(totalConsumedLifetime).toBe(12);
    expect(calculateConsumptionWindows(parsedLogs, 100 * day, 30)).toEqual({ consumed7d: 5, consumed30d: 12, consumedWindow: 12 });
    expect(calculateConsumptionWindows(parsedLogs, 90 * day, 30)).toEqual({ consumed7d: 0, consumed30d: 7, consumedWindow: 7 });
  });

  it('classifies dormant, imminent, warning, and healthy runway states', () => {
    expect(determineRunwayAndRisk(0, 0, 100)).toEqual({ runwayDays: 999, exhaustionRisk: 'dormant' });
    expect(determineRunwayAndRisk(10, 2, 50)).toEqual({ runwayDays: 5, exhaustionRisk: 'imminent' });
    expect(determineRunwayAndRisk(0, 5, 50)).toEqual({ runwayDays: 10, exhaustionRisk: 'warning' });
    expect(determineRunwayAndRisk(1, 2, 20)).toEqual({ runwayDays: 20, exhaustionRisk: 'healthy' });
  });
});

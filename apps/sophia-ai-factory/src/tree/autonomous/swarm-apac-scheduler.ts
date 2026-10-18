/**
 * APAC Peak Engagement Windows & Slot Scheduler
 * Tree Layer - Deterministic timezone-aware schedule optimization for Asian-Pacific markets
 *
 * @module tree/autonomous/swarm-apac-scheduler
 */

import type { ApacMarket } from './swarm-types';
import {
  APAC_MARKET_CONFIGS,
  type ApacMarketConfig,
  type ApacMarketWindow,
} from './swarm-apac-configs';

export {
  APAC_MARKET_CONFIGS,
  type ApacMarketConfig,
  type ApacMarketWindow,
};

/**
 * Checks if a specific Date falls within an APAC market's peak engagement windows.
 */
export function isApacPeakTime(date: Date, market: ApacMarket = 'VN'): boolean {
  const config = APAC_MARKET_CONFIGS[market] ?? APAC_MARKET_CONFIGS.VN;
  const localTimeMs = date.getTime() + config.utcOffsetHours * 3600 * 1000;
  const localDate = new Date(localTimeMs);
  const currentMinutes = localDate.getUTCHours() * 60 + localDate.getUTCMinutes();

  for (const win of config.peakWindows) {
    const startMins = win.startH * 60 + win.startM;
    const endMins = win.endH * 60 + win.endM;
    if (currentMinutes >= startMins && currentMinutes <= endMins) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates the next optimal APAC peak publishing slot starting from a reference date.
 */
export function calculateNextApacPeakSlot(
  fromDate: Date = new Date(),
  market: ApacMarket = 'VN',
): Date {
  const config = APAC_MARKET_CONFIGS[market] ?? APAC_MARKET_CONFIGS.VN;

  if (isApacPeakTime(fromDate, market)) {
    return fromDate;
  }

  const localTimeMs = fromDate.getTime() + config.utcOffsetHours * 3600 * 1000;
  const localDate = new Date(localTimeMs);
  const currentMinutes = localDate.getUTCHours() * 60 + localDate.getUTCMinutes();

  for (const win of config.peakWindows) {
    const startMins = win.startH * 60 + win.startM;
    if (startMins > currentMinutes) {
      const slotLocal = new Date(localDate);
      slotLocal.setUTCHours(win.startH, win.startM, 0, 0);
      const slotUtcMs = slotLocal.getTime() - config.utcOffsetHours * 3600 * 1000;
      return new Date(slotUtcMs);
    }
  }

  const firstWindow = config.peakWindows[0];
  const slotLocalTomorrow = new Date(localDate);
  slotLocalTomorrow.setUTCDate(slotLocalTomorrow.getUTCDate() + 1);
  slotLocalTomorrow.setUTCHours(firstWindow.startH, firstWindow.startM, 0, 0);
  const slotUtcMs = slotLocalTomorrow.getTime() - config.utcOffsetHours * 3600 * 1000;
  return new Date(slotUtcMs);
}

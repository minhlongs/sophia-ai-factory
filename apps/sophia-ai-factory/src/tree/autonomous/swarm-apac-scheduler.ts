/**
 * APAC Peak Engagement Windows & Slot Scheduler
 * Tree Layer - Deterministic timezone-aware schedule optimization for Asian-Pacific markets
 *
 * @module tree/autonomous/swarm-apac-scheduler
 */

import type { ApacMarket } from './swarm-types';

export interface ApacMarketWindow {
  startH: number;
  startM: number;
  endH: number;
  endM: number;
  label: string;
}

export interface ApacMarketConfig {
  market: ApacMarket;
  timezone: string;
  utcOffsetHours: number;
  peakWindows: ApacMarketWindow[];
}

export const APAC_MARKET_CONFIGS: Record<ApacMarket, ApacMarketConfig> = {
  VN: {
    market: 'VN',
    timezone: 'Asia/Ho_Chi_Minh',
    utcOffsetHours: 7,
    peakWindows: [
      { startH: 11, startM: 30, endH: 13, endM: 30, label: 'VN Lunch Peak' },
      { startH: 19, startM: 30, endH: 22, endM: 0, label: 'VN Prime Evening' },
    ],
  },
  TH: {
    market: 'TH',
    timezone: 'Asia/Bangkok',
    utcOffsetHours: 7,
    peakWindows: [
      { startH: 11, startM: 30, endH: 13, endM: 30, label: 'TH Lunch Peak' },
      { startH: 19, startM: 30, endH: 22, endM: 0, label: 'TH Prime Evening' },
    ],
  },
  ID: {
    market: 'ID',
    timezone: 'Asia/Jakarta',
    utcOffsetHours: 7,
    peakWindows: [
      { startH: 12, startM: 0, endH: 13, endM: 30, label: 'ID Lunch Peak' },
      { startH: 19, startM: 0, endH: 21, endM: 30, label: 'ID Evening Peak' },
    ],
  },
  SG: {
    market: 'SG',
    timezone: 'Asia/Singapore',
    utcOffsetHours: 8,
    peakWindows: [
      { startH: 12, startM: 0, endH: 14, endM: 0, label: 'SG Lunch Peak' },
      { startH: 20, startM: 0, endH: 22, endM: 30, label: 'SG Prime Evening' },
    ],
  },
  MY: {
    market: 'MY',
    timezone: 'Asia/Kuala_Lumpur',
    utcOffsetHours: 8,
    peakWindows: [
      { startH: 12, startM: 0, endH: 14, endM: 0, label: 'MY Lunch Peak' },
      { startH: 20, startM: 0, endH: 22, endM: 0, label: 'MY Evening Peak' },
    ],
  },
  JP: {
    market: 'JP',
    timezone: 'Asia/Tokyo',
    utcOffsetHours: 9,
    peakWindows: [
      { startH: 12, startM: 0, endH: 13, endM: 0, label: 'JP Commute/Lunch' },
      { startH: 18, startM: 30, endH: 21, endM: 30, label: 'JP Prime Evening' },
    ],
  },
  KR: {
    market: 'KR',
    timezone: 'Asia/Seoul',
    utcOffsetHours: 9,
    peakWindows: [
      { startH: 12, startM: 0, endH: 13, endM: 0, label: 'KR Lunch Peak' },
      { startH: 19, startM: 0, endH: 22, endM: 0, label: 'KR Prime Evening' },
    ],
  },
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

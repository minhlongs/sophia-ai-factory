/**
 * @file market-configs.ts
 * @layer tree/publishing/apac
 * @description APAC market peak hour configuration definitions and utilities.
 */

import type {
  ApacMarket,
  MarketPeakConfig,
} from '@/seed/types/apac-syndication';

export const APAC_MARKET_PEAKS: Record<ApacMarket, MarketPeakConfig> = {
  hanoi: {
    market: 'hanoi',
    displayName: 'Hà Nội (Vietnam)',
    timezone: 'Asia/Ho_Chi_Minh',
    utcOffsetHours: 7,
    slots: [
      { hour: 11, minute: 30, name: 'lunch_peak' },
      { hour: 19, minute: 30, name: 'evening_peak' },
    ],
  },
  tokyo: {
    market: 'tokyo',
    displayName: 'Tokyo (Japan)',
    timezone: 'Asia/Tokyo',
    utcOffsetHours: 9,
    slots: [
      { hour: 12, minute: 0, name: 'lunch_peak' },
      { hour: 20, minute: 0, name: 'prime_time' },
    ],
  },
  bangkok: {
    market: 'bangkok',
    displayName: 'Bangkok (Thailand)',
    timezone: 'Asia/Bangkok',
    utcOffsetHours: 7,
    slots: [
      { hour: 12, minute: 0, name: 'lunch_peak' },
      { hour: 20, minute: 30, name: 'evening_prime' },
    ],
  },
  seoul: {
    market: 'seoul',
    displayName: 'Seoul (South Korea)',
    timezone: 'Asia/Seoul',
    utcOffsetHours: 9,
    slots: [
      { hour: 12, minute: 0, name: 'lunch_peak' },
      { hour: 19, minute: 0, name: 'evening_peak' },
    ],
  },
  singapore: {
    market: 'singapore',
    displayName: 'Singapore',
    timezone: 'Asia/Singapore',
    utcOffsetHours: 8,
    slots: [
      { hour: 12, minute: 30, name: 'lunch_peak' },
      { hour: 20, minute: 0, name: 'evening_peak' },
    ],
  },
};

export function getMarketPeakConfig(market: ApacMarket): MarketPeakConfig {
  const config = APAC_MARKET_PEAKS[market];
  if (!config) {
    throw new Error(`Unsupported APAC market: ${market}`);
  }
  return config;
}

export function detectMarketFromTimezone(timezone?: string): ApacMarket {
  if (!timezone) return 'hanoi';

  const tz = timezone.toLowerCase();
  if (tz.includes('ho_chi_minh') || tz.includes('saigon') || tz.includes('hanoi') || tz.includes('vietnam')) {
    return 'hanoi';
  }
  if (tz.includes('tokyo') || tz.includes('japan')) {
    return 'tokyo';
  }
  if (tz.includes('bangkok') || tz.includes('thailand')) {
    return 'bangkok';
  }
  if (tz.includes('seoul') || tz.includes('korea')) {
    return 'seoul';
  }
  if (tz.includes('singapore')) {
    return 'singapore';
  }

  return 'hanoi';
}

export function getAllSupportedMarkets(): ApacMarket[] {
  return Object.keys(APAC_MARKET_PEAKS) as ApacMarket[];
}

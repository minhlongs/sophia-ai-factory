/**
 * APAC Market Timezone & Peak Engagement Window Configurations
 *
 * @module tree/autonomous/swarm-apac-configs
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

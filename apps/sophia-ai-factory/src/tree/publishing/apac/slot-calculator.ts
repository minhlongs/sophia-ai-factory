/**
 * @file slot-calculator.ts
 * @layer tree/publishing/apac
 * @description Optimal peak publishing slot calculation and peak window detection.
 */

import type {
  ApacMarket,
  PeakSlotResult,
} from '@/seed/types/apac-syndication';
import { getMarketPeakConfig } from './market-configs';
import {
  getZonedDateParts,
  convertLocalToUtcMs,
  formatLocalPeakTime,
} from './time-converter';

export function calculateNextPeakPublishTime(
  requestedTimeMs: number,
  market: ApacMarket = 'hanoi'
): PeakSlotResult {
  const config = getMarketPeakConfig(market);
  const currentParts = getZonedDateParts(requestedTimeMs, config.timezone);

  for (const slot of config.slots) {
    const slotUtcMs = convertLocalToUtcMs(
      currentParts.year,
      currentParts.month,
      currentParts.day,
      slot.hour,
      slot.minute,
      0,
      config.utcOffsetHours
    );

    if (slotUtcMs > requestedTimeMs) {
      return {
        scheduledAtMs: slotUtcMs,
        slotName: slot.name,
        timeZone: config.timezone,
        market,
        localTimeFormatted: formatLocalPeakTime(slotUtcMs, config.timezone),
        isRollover: false,
      };
    }
  }

  const tomorrowParts = getZonedDateParts(
    requestedTimeMs + 24 * 60 * 60 * 1000,
    config.timezone
  );
  const firstSlot = config.slots[0];
  const nextDaySlotUtcMs = convertLocalToUtcMs(
    tomorrowParts.year,
    tomorrowParts.month,
    tomorrowParts.day,
    firstSlot.hour,
    firstSlot.minute,
    0,
    config.utcOffsetHours
  );

  return {
    scheduledAtMs: nextDaySlotUtcMs,
    slotName: firstSlot.name,
    timeZone: config.timezone,
    market,
    localTimeFormatted: formatLocalPeakTime(nextDaySlotUtcMs, config.timezone),
    isRollover: true,
  };
}

export function isPeakHour(
  timestampMs: number,
  market: ApacMarket,
  toleranceMinutes: number = 30
): boolean {
  const config = getMarketPeakConfig(market);
  const parts = getZonedDateParts(timestampMs, config.timezone);
  const currentTotalMinutes = parts.hour * 60 + parts.minute;

  for (const slot of config.slots) {
    const slotTotalMinutes = slot.hour * 60 + slot.minute;
    if (Math.abs(currentTotalMinutes - slotTotalMinutes) <= toleranceMinutes) {
      return true;
    }
  }

  return false;
}

export function getTodayPeakSlots(
  baseDateMs: number,
  market: ApacMarket
): PeakSlotResult[] {
  const config = getMarketPeakConfig(market);
  const parts = getZonedDateParts(baseDateMs, config.timezone);

  return config.slots.map((slot) => {
    const utcMs = convertLocalToUtcMs(
      parts.year,
      parts.month,
      parts.day,
      slot.hour,
      slot.minute,
      0,
      config.utcOffsetHours
    );
    return {
      scheduledAtMs: utcMs,
      slotName: slot.name,
      timeZone: config.timezone,
      market,
      localTimeFormatted: formatLocalPeakTime(utcMs, config.timezone),
      isRollover: false,
    };
  });
}

/**
 * APAC Peak-Time Scheduling Optimizer
 *
 * Implements golden hour scheduling for top APAC video growth markets:
 * - Hà Nội (UTC+7, Asia/Ho_Chi_Minh): 11:30 & 19:30
 * - Tokyo (UTC+9, Asia/Tokyo): 12:00 & 20:00
 * - Bangkok (UTC+7, Asia/Bangkok): 12:00 & 20:30
 * - Seoul (UTC+9, Asia/Seoul): 12:00 & 19:00
 * - Singapore (UTC+8, Asia/Singapore): 12:30 & 20:00
 *
 * Layer: Tree (pure domain logic, algorithms without side effects)
 * Dependencies: imports only seed
 *
 * @module tree/publishing/apac-peak-optimizer
 */

import type {
  ApacMarket,
  MarketPeakConfig,
  PeakSlotResult,
  PeakTimeSlot,
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

/**
 * Extract zoned date/time parts using standard Intl.DateTimeFormat
 */
export function getZonedDateParts(
  timestampMs: number,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  let targetTz = timeZone;
  let formatter: Intl.DateTimeFormat;

  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: targetTz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
  } catch {
    targetTz = 'UTC';
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
  }

  const parts: Record<string, string> = {};
  formatter.formatToParts(new Date(timestampMs)).forEach((p) => {
    parts[p.type] = p.value;
  });

  return {
    year: parseInt(parts.year ?? '1970', 10),
    month: parseInt(parts.month ?? '1', 10),
    day: parseInt(parts.day ?? '1', 10),
    // Handle 24-hour edge case where midnight is formatted as '24'
    hour: parseInt(parts.hour ?? '0', 10) % 24,
    minute: parseInt(parts.minute ?? '0', 10),
    second: parseInt(parts.second ?? '0', 10),
  };
}

/**
 * Convert local date/time in target market timezone to UTC epoch milliseconds.
 * All APAC target markets (Hanoi, Tokyo, Bangkok, Seoul, Singapore) have fixed UTC offsets (no DST).
 */
export function convertLocalToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number = 0,
  utcOffsetHours: number = 0,
): number {
  return (
    Date.UTC(year, month - 1, day, hour, minute, second) -
    utcOffsetHours * 3600 * 1000
  );
}

/**
 * Retrieve configuration for a specific APAC market
 */
export function getMarketPeakConfig(market: ApacMarket): MarketPeakConfig {
  const config = APAC_MARKET_PEAKS[market];
  if (!config) {
    throw new Error(`Unsupported APAC market: ${market}`);
  }
  return config;
}

/**
 * Infer the closest APAC market from an IANA timezone string
 */
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

/**
 * List all supported APAC markets
 */
export function getAllSupportedMarkets(): ApacMarket[] {
  return Object.keys(APAC_MARKET_PEAKS) as ApacMarket[];
}

/**
 * Format a peak slot time for human-readable logging or UI presentation
 */
export function formatLocalPeakTime(timestampMs: number, timezone: string): string {
  const parts = getZonedDateParts(timestampMs, timezone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)} (${timezone})`;
}

/**
 * Calculate the next optimal peak publishing slot for the specified APAC market.
 *
 * Algorithm:
 * 1. Convert requested time to market's local time parts.
 * 2. Check each slot for the current day:
 *    - If requested time < slot time, choose that slot today.
 * 3. If requested time is past all slots today, roll over to slot 0 tomorrow.
 * 4. Return epoch milliseconds, slot name, and timezone.
 *
 * @param requestedTimeMs - Epoch milliseconds of requested publication time (or Date.now())
 * @param market - Target APAC market (hanoi, tokyo, bangkok, seoul, singapore)
 * @returns PeakSlotResult containing scheduledAtMs, slotName, timeZone, localTimeFormatted, isRollover
 */
export function calculateNextPeakPublishTime(
  requestedTimeMs: number,
  market: ApacMarket = 'hanoi',
): PeakSlotResult {
  const config = getMarketPeakConfig(market);
  const currentParts = getZonedDateParts(requestedTimeMs, config.timezone);

  // Check same-day slots in ascending order
  for (const slot of config.slots) {
    const slotUtcMs = convertLocalToUtcMs(
      currentParts.year,
      currentParts.month,
      currentParts.day,
      slot.hour,
      slot.minute,
      0,
      config.utcOffsetHours,
    );

    // If slot is strictly after requested time (or within a 30s grace window)
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

  // Rollover to the first slot of the next calendar day
  const tomorrowParts = getZonedDateParts(
    requestedTimeMs + 24 * 60 * 60 * 1000,
    config.timezone,
  );
  const firstSlot = config.slots[0];
  const nextDaySlotUtcMs = convertLocalToUtcMs(
    tomorrowParts.year,
    tomorrowParts.month,
    tomorrowParts.day,
    firstSlot.hour,
    firstSlot.minute,
    0,
    config.utcOffsetHours,
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

/**
 * Checks whether a given timestamp falls within an APAC peak publishing window
 * (+/- toleranceMinutes of any designated peak slot for that market).
 */
export function isPeakHour(
  timestampMs: number,
  market: ApacMarket,
  toleranceMinutes: number = 30,
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

/**
 * Retrieve all peak slots for today in the specified market.
 */
export function getTodayPeakSlots(
  baseDateMs: number,
  market: ApacMarket,
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
      config.utcOffsetHours,
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

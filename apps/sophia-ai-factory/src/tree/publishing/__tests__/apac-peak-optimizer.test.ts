import { describe, it, expect } from 'vitest';
import {
  APAC_MARKET_PEAKS,
  calculateNextPeakPublishTime,
  convertLocalToUtcMs,
  detectMarketFromTimezone,
  formatLocalPeakTime,
  getAllSupportedMarkets,
  getMarketPeakConfig,
  getTodayPeakSlots,
  getZonedDateParts,
  isPeakHour,
} from '../apac-peak-optimizer';
import type { ApacMarket } from '@/seed/types/apac-syndication';

describe('APAC Peak-Time Scheduling Optimizer', () => {
  describe('Market Configurations', () => {
    it('defines golden hours for all 5 core APAC markets', () => {
      const markets = getAllSupportedMarkets();
      expect(markets).toEqual(
        expect.arrayContaining(['hanoi', 'tokyo', 'bangkok', 'seoul', 'singapore']),
      );

      // Hà Nội (UTC+7, Asia/Ho_Chi_Minh): 11:30 & 19:30
      const hanoi = getMarketPeakConfig('hanoi');
      expect(hanoi.timezone).toBe('Asia/Ho_Chi_Minh');
      expect(hanoi.utcOffsetHours).toBe(7);
      expect(hanoi.slots).toEqual([
        { hour: 11, minute: 30, name: 'lunch_peak' },
        { hour: 19, minute: 30, name: 'evening_peak' },
      ]);

      // Tokyo (UTC+9, Asia/Tokyo): 12:00 & 20:00
      const tokyo = getMarketPeakConfig('tokyo');
      expect(tokyo.timezone).toBe('Asia/Tokyo');
      expect(tokyo.utcOffsetHours).toBe(9);
      expect(tokyo.slots).toEqual([
        { hour: 12, minute: 0, name: 'lunch_peak' },
        { hour: 20, minute: 0, name: 'prime_time' },
      ]);

      // Bangkok (UTC+7, Asia/Bangkok): 12:00 & 20:30
      const bangkok = getMarketPeakConfig('bangkok');
      expect(bangkok.timezone).toBe('Asia/Bangkok');
      expect(bangkok.utcOffsetHours).toBe(7);
      expect(bangkok.slots).toEqual([
        { hour: 12, minute: 0, name: 'lunch_peak' },
        { hour: 20, minute: 30, name: 'evening_prime' },
      ]);

      // Seoul (UTC+9, Asia/Seoul): 12:00 & 19:00
      const seoul = getMarketPeakConfig('seoul');
      expect(seoul.timezone).toBe('Asia/Seoul');
      expect(seoul.utcOffsetHours).toBe(9);
      expect(seoul.slots).toEqual([
        { hour: 12, minute: 0, name: 'lunch_peak' },
        { hour: 19, minute: 0, name: 'evening_peak' },
      ]);

      // Singapore (UTC+8, Asia/Singapore): 12:30 & 20:00
      const singapore = getMarketPeakConfig('singapore');
      expect(singapore.timezone).toBe('Asia/Singapore');
      expect(singapore.utcOffsetHours).toBe(8);
      expect(singapore.slots).toEqual([
        { hour: 12, minute: 30, name: 'lunch_peak' },
        { hour: 20, minute: 0, name: 'evening_peak' },
      ]);
    });

    it('throws error for unsupported markets', () => {
      expect(() => getMarketPeakConfig('london' as unknown as ApacMarket)).toThrow(
        /Unsupported APAC market/,
      );
    });
  });

  describe('Timezone & Date Helpers', () => {
    it('accurately parses date parts in target timezone', () => {
      // 2026-09-25 04:30:00 UTC = 2026-09-25 11:30:00 in Asia/Ho_Chi_Minh (UTC+7)
      const testUtcMs = Date.UTC(2026, 8, 25, 4, 30, 0);
      const parts = getZonedDateParts(testUtcMs, 'Asia/Ho_Chi_Minh');

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(9);
      expect(parts.day).toBe(25);
      expect(parts.hour).toBe(11);
      expect(parts.minute).toBe(30);
    });

    it('converts local time parts to exact UTC timestamp', () => {
      // Hanoi 2026-09-25 11:30:00 local (UTC+7) -> 2026-09-25 04:30:00 UTC
      const utcMs = convertLocalToUtcMs(2026, 9, 25, 11, 30, 0, 7);
      const expectedUtc = Date.UTC(2026, 8, 25, 4, 30, 0);
      expect(utcMs).toBe(expectedUtc);
    });

    it('detects market correctly from timezone strings', () => {
      expect(detectMarketFromTimezone('Asia/Ho_Chi_Minh')).toBe('hanoi');
      expect(detectMarketFromTimezone('Asia/Saigon')).toBe('hanoi');
      expect(detectMarketFromTimezone('Asia/Tokyo')).toBe('tokyo');
      expect(detectMarketFromTimezone('Asia/Bangkok')).toBe('bangkok');
      expect(detectMarketFromTimezone('Asia/Seoul')).toBe('seoul');
      expect(detectMarketFromTimezone('Asia/Singapore')).toBe('singapore');
      expect(detectMarketFromTimezone('America/New_York')).toBe('hanoi');
      expect(detectMarketFromTimezone(undefined)).toBe('hanoi');
    });

    it('formats local peak time with timezone stamp', () => {
      const utcMs = Date.UTC(2026, 8, 25, 4, 30, 0);
      const formatted = formatLocalPeakTime(utcMs, 'Asia/Ho_Chi_Minh');
      expect(formatted).toBe('2026-09-25 11:30 (Asia/Ho_Chi_Minh)');
    });
  });

  describe('calculateNextPeakPublishTime', () => {
    describe('Hanoi Market (11:30 & 19:30 UTC+7)', () => {
      it('schedules at 11:30 same day when requested at 10:00 local', () => {
        // Hanoi 2026-09-25 10:00:00 local = 03:00:00 UTC
        const reqUtcMs = Date.UTC(2026, 8, 25, 3, 0, 0);
        const result = calculateNextPeakPublishTime(reqUtcMs, 'hanoi');

        expect(result.market).toBe('hanoi');
        expect(result.slotName).toBe('lunch_peak');
        expect(result.isRollover).toBe(false);
        expect(result.timeZone).toBe('Asia/Ho_Chi_Minh');

        const parts = getZonedDateParts(result.scheduledAtMs, 'Asia/Ho_Chi_Minh');
        expect(parts.day).toBe(25);
        expect(parts.hour).toBe(11);
        expect(parts.minute).toBe(30);
      });

      it('schedules at 19:30 same day when requested at 15:00 local', () => {
        // Hanoi 2026-09-25 15:00:00 local = 08:00:00 UTC
        const reqUtcMs = Date.UTC(2026, 8, 25, 8, 0, 0);
        const result = calculateNextPeakPublishTime(reqUtcMs, 'hanoi');

        expect(result.slotName).toBe('evening_peak');
        expect(result.isRollover).toBe(false);

        const parts = getZonedDateParts(result.scheduledAtMs, 'Asia/Ho_Chi_Minh');
        expect(parts.day).toBe(25);
        expect(parts.hour).toBe(19);
        expect(parts.minute).toBe(30);
      });

      it('rolls over to 11:30 next day when requested at 20:00 local', () => {
        // Hanoi 2026-09-25 20:00:00 local = 13:00:00 UTC
        const reqUtcMs = Date.UTC(2026, 8, 25, 13, 0, 0);
        const result = calculateNextPeakPublishTime(reqUtcMs, 'hanoi');

        expect(result.slotName).toBe('lunch_peak');
        expect(result.isRollover).toBe(true);

        const parts = getZonedDateParts(result.scheduledAtMs, 'Asia/Ho_Chi_Minh');
        expect(parts.day).toBe(26); // Next day!
        expect(parts.hour).toBe(11);
        expect(parts.minute).toBe(30);
      });
    });

    describe('Tokyo Market (12:00 & 20:00 UTC+9)', () => {
      it('schedules at 12:00 same day when requested at 09:00 local', () => {
        // Tokyo 2026-09-25 09:00:00 local = 00:00:00 UTC
        const reqUtcMs = Date.UTC(2026, 8, 25, 0, 0, 0);
        const result = calculateNextPeakPublishTime(reqUtcMs, 'tokyo');

        expect(result.market).toBe('tokyo');
        expect(result.slotName).toBe('lunch_peak');
        expect(result.isRollover).toBe(false);

        const parts = getZonedDateParts(result.scheduledAtMs, 'Asia/Tokyo');
        expect(parts.day).toBe(25);
        expect(parts.hour).toBe(12);
        expect(parts.minute).toBe(0);
      });

      it('schedules at 20:00 same day when requested at 15:00 local', () => {
        // Tokyo 2026-09-25 15:00:00 local = 06:00:00 UTC
        const reqUtcMs = Date.UTC(2026, 8, 25, 6, 0, 0);
        const result = calculateNextPeakPublishTime(reqUtcMs, 'tokyo');

        expect(result.slotName).toBe('prime_time');
        expect(result.isRollover).toBe(false);

        const parts = getZonedDateParts(result.scheduledAtMs, 'Asia/Tokyo');
        expect(parts.day).toBe(25);
        expect(parts.hour).toBe(20);
        expect(parts.minute).toBe(0);
      });

      it('rolls over to 12:00 next day when requested at 21:00 local', () => {
        // Tokyo 2026-09-25 21:00:00 local = 12:00:00 UTC
        const reqUtcMs = Date.UTC(2026, 8, 25, 12, 0, 0);
        const result = calculateNextPeakPublishTime(reqUtcMs, 'tokyo');

        expect(result.slotName).toBe('lunch_peak');
        expect(result.isRollover).toBe(true);

        const parts = getZonedDateParts(result.scheduledAtMs, 'Asia/Tokyo');
        expect(parts.day).toBe(26);
        expect(parts.hour).toBe(12);
        expect(parts.minute).toBe(0);
      });
    });

    describe('Bangkok Market (12:00 & 20:30 UTC+7)', () => {
      it('schedules at 12:00 same day when requested at 08:30 local', () => {
        // Bangkok 2026-09-25 08:30:00 local = 01:30:00 UTC
        const reqUtcMs = Date.UTC(2026, 8, 25, 1, 30, 0);
        const result = calculateNextPeakPublishTime(reqUtcMs, 'bangkok');

        expect(result.slotName).toBe('lunch_peak');
        expect(result.isRollover).toBe(false);

        const parts = getZonedDateParts(result.scheduledAtMs, 'Asia/Bangkok');
        expect(parts.day).toBe(25);
        expect(parts.hour).toBe(12);
        expect(parts.minute).toBe(0);
      });

      it('schedules at 20:30 same day when requested at 14:00 local', () => {
        // Bangkok 2026-09-25 14:00:00 local = 07:00:00 UTC
        const reqUtcMs = Date.UTC(2026, 8, 25, 7, 0, 0);
        const result = calculateNextPeakPublishTime(reqUtcMs, 'bangkok');

        expect(result.slotName).toBe('evening_prime');
        expect(result.isRollover).toBe(false);

        const parts = getZonedDateParts(result.scheduledAtMs, 'Asia/Bangkok');
        expect(parts.day).toBe(25);
        expect(parts.hour).toBe(20);
        expect(parts.minute).toBe(30);
      });

      it('rolls over to 12:00 next day when requested at 21:00 local', () => {
        // Bangkok 2026-09-25 21:00:00 local = 14:00:00 UTC
        const reqUtcMs = Date.UTC(2026, 8, 25, 14, 0, 0);
        const result = calculateNextPeakPublishTime(reqUtcMs, 'bangkok');

        expect(result.slotName).toBe('lunch_peak');
        expect(result.isRollover).toBe(true);

        const parts = getZonedDateParts(result.scheduledAtMs, 'Asia/Bangkok');
        expect(parts.day).toBe(26);
        expect(parts.hour).toBe(12);
        expect(parts.minute).toBe(0);
      });
    });

    describe('Seoul Market (12:00 & 19:00 UTC+9)', () => {
      it('schedules at 19:00 same day when requested at 14:00 local', () => {
        // Seoul 2026-09-25 14:00:00 local = 05:00:00 UTC
        const reqUtcMs = Date.UTC(2026, 8, 25, 5, 0, 0);
        const result = calculateNextPeakPublishTime(reqUtcMs, 'seoul');

        expect(result.slotName).toBe('evening_peak');
        expect(result.isRollover).toBe(false);

        const parts = getZonedDateParts(result.scheduledAtMs, 'Asia/Seoul');
        expect(parts.day).toBe(25);
        expect(parts.hour).toBe(19);
        expect(parts.minute).toBe(0);
      });
    });

    describe('Singapore Market (12:30 & 20:00 UTC+8)', () => {
      it('schedules at 12:30 same day when requested at 11:00 local', () => {
        // Singapore 2026-09-25 11:00:00 local = 03:00:00 UTC
        const reqUtcMs = Date.UTC(2026, 8, 25, 3, 0, 0);
        const result = calculateNextPeakPublishTime(reqUtcMs, 'singapore');

        expect(result.slotName).toBe('lunch_peak');
        expect(result.isRollover).toBe(false);

        const parts = getZonedDateParts(result.scheduledAtMs, 'Asia/Singapore');
        expect(parts.day).toBe(25);
        expect(parts.hour).toBe(12);
        expect(parts.minute).toBe(30);
      });
    });
  });

  describe('isPeakHour', () => {
    it('returns true when time is within tolerance of peak slot', () => {
      // Hanoi 11:40 (10 mins after 11:30 slot)
      const hanoiTimeMs = Date.UTC(2026, 8, 25, 4, 40, 0);
      expect(isPeakHour(hanoiTimeMs, 'hanoi', 15)).toBe(true);

      // Hanoi 19:25 (5 mins before 19:30 slot)
      const eveningTimeMs = Date.UTC(2026, 8, 25, 12, 25, 0);
      expect(isPeakHour(eveningTimeMs, 'hanoi', 15)).toBe(true);
    });

    it('returns false when time is outside tolerance window', () => {
      // Hanoi 03:00 AM local
      const offPeakMs = Date.UTC(2026, 8, 25, 20, 0, 0);
      expect(isPeakHour(offPeakMs, 'hanoi', 30)).toBe(false);
    });
  });

  describe('getTodayPeakSlots', () => {
    it('returns all defined slots for the given date in local time', () => {
      const baseDateMs = Date.UTC(2026, 8, 25, 4, 0, 0); // 11:00 local Hanoi
      const slots = getTodayPeakSlots(baseDateMs, 'hanoi');

      expect(slots).toHaveLength(2);
      expect(slots[0].slotName).toBe('lunch_peak');
      expect(slots[0].localTimeFormatted).toContain('11:30 (Asia/Ho_Chi_Minh)');
      expect(slots[1].slotName).toBe('evening_peak');
      expect(slots[1].localTimeFormatted).toContain('19:30 (Asia/Ho_Chi_Minh)');
    });
  });
});

/**
 * Unit tests for overage-formatter utility
 * @module land/billing/__tests__/overage-formatter.test
 */

import { describe, it, expect } from 'vitest';
import {
  formatOverageEvent,
  formatOverageEvents,
  calculateOverageTotals,
  filterByBillableStatus,
  filterByType,
  groupEventsByDate,
} from '../overage-formatter';
import type { OverageEvent } from '@/seed/types/billing-contracts';

describe('OverageFormatter', () => {
  const mockOverageEvents: OverageEvent[] = [
    {
      id: 'evt_001',
      userId: 'user_123',
      licenseNonce: 'license_abc',
      exceededType: 'hourly_credits',
      exceededLimit: 100,
      exceededCurrent: 120,
      exceededBy: 20,
      requestedCredits: 150,
      billable: true,
      createdAt: 1736884200000,
      endpoint: '/api/generate',
      serviceName: 'video-generation',
      action: 'create',
      tierAtExceeded: 'PREMIUM',
    },
    {
      id: 'evt_002',
      userId: 'user_456',
      licenseNonce: 'license_def',
      exceededType: 'daily_credits',
      exceededLimit: 1000,
      exceededCurrent: 1200,
      exceededBy: 200,
      requestedCredits: 500,
      billable: false,
      createdAt: 1736926800000,
      endpoint: undefined,
      serviceName: undefined,
      action: undefined,
      tierAtExceeded: 'BASIC',
    },
    {
      id: 'evt_003',
      userId: 'user_789',
      licenseNonce: 'license_ghi',
      exceededType: 'monthly_credits',
      exceededLimit: 5000,
      exceededCurrent: 5500,
      exceededBy: 500,
      requestedCredits: 1000,
      billable: true,
      createdAt: 1737013200000,
      endpoint: '/api/tts',
      serviceName: 'text-to-speech',
      action: 'synthesize',
      tierAtExceeded: 'ENTERPRISE',
    },
  ];

  describe('formatOverageEvent', () => {
    it('should format a single overage event correctly', () => {
      const event = mockOverageEvents[0];
      const formatted = formatOverageEvent(event);

      expect(formatted).toEqual({
        id: 'evt_001',
        exceededType: 'hourly_credits',
        exceededLimit: 100,
        exceededCurrent: 120,
        exceededBy: 20,
        requestedCredits: 150,
        endpoint: '/api/generate',
        service: 'video-generation',
        action: 'create',
        billable: true,
        createdAt: '2025-01-14T19:50:00.000Z',
      });
    });

    it('should convert null fields to null', () => {
      const event: OverageEvent = {
        id: 'evt_null',
        userId: 'user_1',
        licenseNonce: 'lic_1',
        exceededType: 'daily_requests',
        exceededLimit: 100,
        exceededCurrent: 150,
        exceededBy: 50,
        requestedCredits: 200,
        billable: true,
        createdAt: 1736884200000,
        endpoint: undefined,
        serviceName: undefined,
        action: undefined,
        tierAtExceeded: 'BASIC',
      };
      const formatted = formatOverageEvent(event);

      expect(formatted.endpoint).toBeNull();
      expect(formatted.service).toBeNull();
      expect(formatted.action).toBeNull();
    });

    it('should handle all exceededType values', () => {
      const types: Array<'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests'> = [
        'hourly_credits',
        'daily_credits',
        'monthly_credits',
        'daily_requests',
      ];

      types.forEach(type => {
        const event: OverageEvent = {
          id: `evt_${type}`,
          userId: 'user_test',
          licenseNonce: 'lic_test',
          exceededType: type,
          exceededLimit: 100,
          exceededCurrent: 120,
          exceededBy: 20,
          requestedCredits: 150,
          billable: true,
          createdAt: 1736884200000,
          endpoint: undefined,
          serviceName: undefined,
          action: undefined,
          tierAtExceeded: 'PREMIUM',
        };

        const formatted = formatOverageEvent(event);
        expect(formatted.exceededType).toBe(type);
      });
    });
  });

  describe('formatOverageEvents', () => {
    it('should format an array of events', () => {
      const formatted = formatOverageEvents(mockOverageEvents);

      expect(formatted).toHaveLength(3);
      expect(formatted[0].id).toBe('evt_001');
      expect(formatted[1].id).toBe('evt_002');
      expect(formatted[2].id).toBe('evt_003');
    });

    it('should return empty array for empty input', () => {
      const formatted = formatOverageEvents([]);
      expect(formatted).toEqual([]);
    });

    it('should preserve order of events', () => {
      const reversed = [...mockOverageEvents].reverse();
      const formatted = formatOverageEvents(reversed);

      expect(formatted.map(f => f.id)).toEqual(reversed.map(e => e.id));
    });
  });

  describe('calculateOverageTotals', () => {
    it('should calculate totals correctly', () => {
      const totals = calculateOverageTotals(mockOverageEvents);

      expect(totals).toEqual({
        totalOverage: 720,
        billedOverage: 520,
        unbilledOverage: 200,
        totalEvents: 3,
        billableEvents: 2,
      });
    });

    it('should handle empty array', () => {
      const totals = calculateOverageTotals([]);

      expect(totals).toEqual({
        totalOverage: 0,
        billedOverage: 0,
        unbilledOverage: 0,
        totalEvents: 0,
        billableEvents: 0,
      });
    });

    it('should handle all billable events', () => {
      const allBillable = mockOverageEvents.map(e => ({ ...e, billable: true }));
      const totals = calculateOverageTotals(allBillable);

      expect(totals.billedOverage).toBe(totals.totalOverage);
      expect(totals.unbilledOverage).toBe(0);
      expect(totals.billableEvents).toBe(totals.totalEvents);
    });

    it('should handle all non-billable events', () => {
      const allNonBillable = mockOverageEvents.map(e => ({ ...e, billable: false }));
      const totals = calculateOverageTotals(allNonBillable);

      expect(totals.billedOverage).toBe(0);
      expect(totals.unbilledOverage).toBe(totals.totalOverage);
      expect(totals.billableEvents).toBe(0);
    });

    it('should handle zero exceededBy values', () => {
      const zeroExceeded = mockOverageEvents.map(e => ({ ...e, exceededBy: 0 }));
      const totals = calculateOverageTotals(zeroExceeded);

      expect(totals.totalOverage).toBe(0);
      expect(totals.billedOverage).toBe(0);
      expect(totals.unbilledOverage).toBe(0);
    });

    it('should handle large numbers', () => {
      const largeEvents: OverageEvent[] = [
        {
          id: 'evt_large',
          userId: 'user_large',
          licenseNonce: 'lic_large',
          exceededType: 'hourly_credits',
          exceededLimit: 1000000,
          exceededCurrent: 2000000,
          exceededBy: 1000000,
          requestedCredits: 500000,
          billable: true,
          createdAt: 1736884200000,
          endpoint: undefined,
          serviceName: undefined,
          action: undefined,
          tierAtExceeded: 'ENTERPRISE',
        },
      ];

      const totals = calculateOverageTotals(largeEvents);
      expect(totals.totalOverage).toBe(1000000);
      expect(totals.billedOverage).toBe(1000000);
    });
  });

  describe('filterByBillableStatus', () => {
    it('should filter billable events', () => {
      const billable = filterByBillableStatus(mockOverageEvents, true);

      expect(billable).toHaveLength(2);
      expect(billable.every(e => e.billable)).toBe(true);
    });

    it('should filter non-billable events', () => {
      const nonBillable = filterByBillableStatus(mockOverageEvents, false);

      expect(nonBillable).toHaveLength(1);
      expect(nonBillable[0].billable).toBe(false);
    });

    it('should return empty array when no matches', () => {
      const allBillable = mockOverageEvents.map(e => ({ ...e, billable: true }));
      const nonBillable = filterByBillableStatus(allBillable, false);

      expect(nonBillable).toEqual([]);
    });

    it('should not mutate original array', () => {
      const originalLength = mockOverageEvents.length;
      filterByBillableStatus(mockOverageEvents, true);
      expect(mockOverageEvents).toHaveLength(originalLength);
    });
  });

  describe('filterByType', () => {
    it('should filter by exceededType', () => {
      const hourly = filterByType(mockOverageEvents, 'hourly_credits');

      expect(hourly).toHaveLength(1);
      expect(hourly[0].exceededType).toBe('hourly_credits');
    });

    it('should return empty array when no matches', () => {
      const none = filterByType(mockOverageEvents, 'daily_requests');

      expect(none).toEqual([]);
    });

    it('should handle multiple matches', () => {
      const multiple: OverageEvent[] = [
        ...mockOverageEvents,
        {
          id: 'evt_004',
          userId: 'user_new',
          licenseNonce: 'lic_new',
          exceededType: 'hourly_credits',
          exceededLimit: 50,
          exceededCurrent: 60,
          exceededBy: 10,
          requestedCredits: 100,
          billable: true,
          createdAt: 1737105600000,
          endpoint: undefined,
          serviceName: undefined,
          action: undefined,
          tierAtExceeded: 'BASIC',
        },
      ];

      const hourly = filterByType(multiple, 'hourly_credits');
      expect(hourly).toHaveLength(2);
    });

    it('should not mutate original array', () => {
      const originalLength = mockOverageEvents.length;
      filterByType(mockOverageEvents, 'hourly_credits');
      expect(mockOverageEvents).toHaveLength(originalLength);
    });
  });

  describe('groupEventsByDate', () => {
    it('should group events by date', () => {
      const grouped = groupEventsByDate(mockOverageEvents);

      // mockOverageEvents has 3 events with distinct dates:
      // 1736884200000 -> 2025-01-14
      // 1736926800000 -> 2025-01-15
      // 1737013200000 -> 2025-01-16
      expect(Object.keys(grouped)).toHaveLength(3);
      expect(grouped['2025-01-14']).toHaveLength(1);
      expect(grouped['2025-01-15']).toHaveLength(1);
      expect(grouped['2025-01-16']).toHaveLength(1);
    });

    it('should return empty object for empty array', () => {
      const grouped = groupEventsByDate([]);
      expect(grouped).toEqual({});
    });

    it('should group all events on same date', () => {
      const sameDay = mockOverageEvents.map(e => ({
        ...e,
        createdAt: 1736884200000,
      }));

      const grouped = groupEventsByDate(sameDay);
      expect(Object.keys(grouped)).toHaveLength(1);
      expect(grouped['2025-01-14']).toHaveLength(3);
    });

    it('should correctly parse dates in different timezones', () => {
      const eventUtc: OverageEvent = {
        id: 'evt_utc',
        userId: 'user_utc',
        licenseNonce: 'lic_utc',
        exceededType: 'hourly_credits',
        exceededLimit: 100,
        exceededCurrent: 120,
        exceededBy: 20,
        requestedCredits: 150,
        billable: true,
        createdAt: 1736905200000,
        endpoint: undefined,
        serviceName: undefined,
        action: undefined,
        tierAtExceeded: 'BASIC',
      };

      const grouped = groupEventsByDate([eventUtc]);
      expect(Object.keys(grouped)).toContain('2025-01-15');
    });
  });
});

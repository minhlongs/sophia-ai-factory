import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFakeD1 } from '@/forest/publishing/__tests__/fake-d1-sqlite';
import { getD1, createServerClient } from '@/seed/db/client';
import { D1Client } from '@/seed/db/d1-query-builder';
import type { D1Database } from '@cloudflare/workers-types';

const mockSchema = [
  `CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    license_nonce TEXT,
    credits_used REAL,
    created_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS quota_limits (
    id TEXT PRIMARY KEY,
    license_nonce TEXT UNIQUE,
    custom_daily_credits INTEGER,
    custom_hourly_credits INTEGER,
    custom_monthly_credits INTEGER,
    custom_daily_requests INTEGER,
    created_at INTEGER
  )`
];

let mockFakeD1: ReturnType<typeof createFakeD1> | undefined;
let mockFakeD1Client: D1Client | undefined;

vi.mock('@/seed/db/client', () => {
  return {
    getD1: vi.fn().mockImplementation(() => {
      if (!mockFakeD1) {
        mockFakeD1 = createFakeD1(mockSchema);
      }
      return mockFakeD1;
    }),
    createServerClient: vi.fn().mockImplementation(() => {
      if (!mockFakeD1) {
        mockFakeD1 = createFakeD1(mockSchema);
      }
      if (!mockFakeD1Client) {
        mockFakeD1Client = new D1Client(mockFakeD1 as unknown as D1Database);
      }
      return mockFakeD1Client;
    }),
  };
});

import { calculateCurrentUsage, getEffectiveQuotaLimits } from '../quota-checker-db';

describe('quota-checker-db', () => {
  beforeEach(async () => {
    // Clear tables before each test
    const db = (getD1()) as any;
    db._db.prepare('DELETE FROM usage_events').run();
    db._db.prepare('DELETE FROM quota_limits').run();
  });

  describe('getEffectiveQuotaLimits', () => {
    it('returns default tier limits if no custom row exists', async () => {
      const limits = await getEffectiveQuotaLimits('nonce-none', 'BASIC');
      expect(limits.dailyCredits).toBeDefined();
      expect(limits.hourlyCredits).toBeDefined();
    });

    it('returns custom overrides if present in quota_limits table', async () => {
      const db = (getD1()) as any;
      // Insert a custom limit
      db._db.prepare(
        `INSERT INTO quota_limits (id, license_nonce, custom_daily_credits, custom_hourly_credits, custom_monthly_credits, custom_daily_requests, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run('id-1', 'nonce-custom', 500, 50, 5000, 100, 123456);

      const limits = await getEffectiveQuotaLimits('nonce-custom', 'BASIC');
      expect(limits.dailyCredits).toBe(500);
      expect(limits.hourlyCredits).toBe(50);
      expect(limits.monthlyCredits).toBe(5000);
      expect(limits.dailyRequests).toBe(100);
    });
  });

  describe('calculateCurrentUsage', () => {
    it('correctly aggregates hourly, daily, monthly credits and daily requests', async () => {
      const userId = 'user-123';
      const nonce = 'nonce-123';
      
      const now = Math.floor(Date.now() / 1000);
      const hourStart = Math.floor(now / 3600) * 3600;
      const dayStart = Math.floor(now / 86400) * 86400;
      
      const dateObj = new Date();
      const monthStart = Math.floor(new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).getTime() / 1000);

      const db = (getD1()) as any;

      // 1. Hourly event (also daily, monthly)
      db._db.prepare(
        `INSERT INTO usage_events (id, user_id, license_nonce, credits_used, created_at) VALUES (?, ?, ?, ?, ?)`
      ).run('ev-1', userId, nonce, 5.5, hourStart + 10);

      // 2. Daily event but not hourly (outside hourly window, e.g. 2 hours ago)
      const twoHoursAgo = hourStart - 7200;
      if (twoHoursAgo >= dayStart) {
        db._db.prepare(
          `INSERT INTO usage_events (id, user_id, license_nonce, credits_used, created_at) VALUES (?, ?, ?, ?, ?)`
        ).run('ev-2', userId, nonce, 10.0, twoHoursAgo);
      } else {
        db._db.prepare(
          `INSERT INTO usage_events (id, user_id, license_nonce, credits_used, created_at) VALUES (?, ?, ?, ?, ?)`
        ).run('ev-2', userId, nonce, 10.0, hourStart + 4000);
      }

      // 3. Monthly event but not daily/hourly (e.g. 5 days ago)
      const fiveDaysAgo = dayStart - 5 * 86400;
      if (fiveDaysAgo >= monthStart) {
        db._db.prepare(
          `INSERT INTO usage_events (id, user_id, license_nonce, credits_used, created_at) VALUES (?, ?, ?, ?, ?)`
        ).run('ev-3', userId, nonce, 100.0, fiveDaysAgo);
      }

      // 4. Event for a different user/nonce (should be ignored)
      db._db.prepare(
        `INSERT INTO usage_events (id, user_id, license_nonce, credits_used, created_at) VALUES (?, ?, ?, ?, ?)`
      ).run('ev-4', 'other-user', nonce, 50.0, hourStart + 20);

      // Run calculation
      const usage = await calculateCurrentUsage(userId, nonce);

      // Assertions
      expect(usage.hourly).toBe(5.5);
      expect(usage.daily).toBe(15.5);
      const expectedMonthly = 15.5 + (fiveDaysAgo >= monthStart ? 100.0 : 0);
      expect(usage.monthly).toBe(expectedMonthly);
      expect(usage.requests).toBe(2);
    });

    it('returns zeroes if no events exist for user/nonce', async () => {
      const usage = await calculateCurrentUsage('no-user', 'no-nonce');
      expect(usage).toEqual({
        hourly: 0,
        daily: 0,
        monthly: 0,
        requests: 0
      });
    });
  });
});

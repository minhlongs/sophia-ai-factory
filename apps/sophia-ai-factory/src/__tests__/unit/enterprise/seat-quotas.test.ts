/**
 * Unit Test Suite: Seat Quota Enforcement Engine
 *
 * Validates:
 * 1. Tier seat limits mapping (Free: 1, Starter: 1, Pro: 5, Master: 999)
 * 2. Active member count + unexpired pending invite allocation math
 * 3. Expired invite deduction from quota allocation
 * 4. Error behavior when organization is non-existent
 *
 * @module __tests__/unit/enterprise/seat-quotas.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import {
  TIER_SEAT_LIMITS,
  getMaxSeatsForTier,
} from '@/seed/config/tiers/seat-quotas';
import { checkSeatQuota } from '@/tree/organizations/seat-quota-engine';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => any;
};

describe('Seat Quota Configuration & Engine', () => {
  describe('Tier Seat Limit Definitions', () => {
    it('defines accurate seat allocations per subscription tier', () => {
      expect(getMaxSeatsForTier('free')).toBe(1);
      expect(getMaxSeatsForTier('starter')).toBe(1);
      expect(getMaxSeatsForTier('basic')).toBe(1);
      expect(getMaxSeatsForTier('pro')).toBe(5);
      expect(getMaxSeatsForTier('premium')).toBe(5);
      expect(getMaxSeatsForTier('master')).toBe(999);
      expect(getMaxSeatsForTier('enterprise')).toBe(999);
    });

    it('handles uppercase and whitespace cleanly', () => {
      expect(getMaxSeatsForTier(' PRO ')).toBe(5);
      expect(getMaxSeatsForTier('MASTER')).toBe(999);
      expect(getMaxSeatsForTier('FREE')).toBe(1);
      expect(getMaxSeatsForTier(null)).toBe(1);
      expect(getMaxSeatsForTier(undefined)).toBe(1);
      expect(getMaxSeatsForTier('unknown_plan')).toBe(1);
    });
  });

  describe('checkSeatQuota Engine with In-Memory Database', () => {
    let rawDb: any;
    let db: any;

    beforeEach(() => {
      rawDb = new DatabaseSync(':memory:');
      rawDb.exec(`
        CREATE TABLE organizations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          tier TEXT NOT NULL,
          max_seats INTEGER,
          plan TEXT
        );

        CREATE TABLE organization_members (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL
        );

        CREATE TABLE organization_invitations (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          email TEXT NOT NULL,
          status TEXT NOT NULL,
          expires_at INTEGER NOT NULL
        );
      `);
      db = makeD1(rawDb);
    });

    it('calculates allocation correctly for empty and single-owner org', async () => {
      rawDb.exec(`
        INSERT INTO organizations (id, name, tier, max_seats)
        VALUES ('org_pro', 'Pro Corp', 'pro', 5);

        INSERT INTO organization_members (id, org_id, user_id, role)
        VALUES ('mem_1', 'org_pro', 'usr_owner', 'owner');
      `);

      const result = await checkSeatQuota(db, 'org_pro');
      expect(result.activeMembers).toBe(1);
      expect(result.pendingInvites).toBe(0);
      expect(result.allocated).toBe(1);
      expect(result.maxSeats).toBe(5);
      expect(result.isAllowed).toBe(true);
    });

    it('accounts for unexpired pending invitations in allocated count', async () => {
      const now = Date.now();
      const future = now + 100000;

      rawDb.exec(`
        INSERT INTO organizations (id, name, tier, max_seats)
        VALUES ('org_pro', 'Pro Corp', 'pro', 5);

        INSERT INTO organization_members (id, org_id, user_id, role)
        VALUES ('mem_1', 'org_pro', 'usr_owner', 'owner'),
               ('mem_2', 'org_pro', 'usr_two', 'creator'),
               ('mem_3', 'org_pro', 'usr_three', 'creator');

        INSERT INTO organization_invitations (id, org_id, email, status, expires_at)
        VALUES ('inv_1', 'org_pro', 'pending1@test.com', 'pending', ${future}),
               ('inv_2', 'org_pro', 'pending2@test.com', 'pending', ${future});
      `);

      const result = await checkSeatQuota(db, 'org_pro');
      expect(result.activeMembers).toBe(3);
      expect(result.pendingInvites).toBe(2);
      expect(result.allocated).toBe(5); // 3 members + 2 pending = 5
      expect(result.maxSeats).toBe(5);
      expect(result.isAllowed).toBe(false); // At full capacity!
    });

    it('does not count expired invitations against quota allocation', async () => {
      const now = Date.now();
      const past = now - 50000;
      const future = now + 100000;

      rawDb.exec(`
        INSERT INTO organizations (id, name, tier, max_seats)
        VALUES ('org_pro', 'Pro Corp', 'pro', 5);

        INSERT INTO organization_members (id, org_id, user_id, role)
        VALUES ('mem_1', 'org_pro', 'usr_owner', 'owner'),
               ('mem_2', 'org_pro', 'usr_two', 'creator');

        INSERT INTO organization_invitations (id, org_id, email, status, expires_at)
        VALUES ('inv_expired', 'org_pro', 'expired@test.com', 'pending', ${past}),
               ('inv_active', 'org_pro', 'active@test.com', 'pending', ${future});
      `);

      const result = await checkSeatQuota(db, 'org_pro');
      expect(result.activeMembers).toBe(2);
      expect(result.pendingInvites).toBe(1); // Only active invite counted
      expect(result.allocated).toBe(3);
      expect(result.maxSeats).toBe(5);
      expect(result.isAllowed).toBe(true);
    });

    it('throws descriptive ORGANIZATION_NOT_FOUND error for non-existent org', async () => {
      await expect(checkSeatQuota(db, 'org_ghost')).rejects.toThrow(
        /ORGANIZATION_NOT_FOUND/,
      );
    });
  });
});

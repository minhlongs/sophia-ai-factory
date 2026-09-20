/**
 * Adversarial Stress & Chaos Test Suite: Milestone 2 Seat Quotas & Invitation Token Lifecycle
 *
 * Empirical challenger test suite challenging:
 * 1. Race conditions on single-use token consumption (CAS verification & anti-replay)
 * 2. Expired tokens & TTL boundary conditions (>7 days, sub-millisecond, quota release)
 * 3. Seat quota oversubscription across all tiers (Free: 1, Starter: 1, Pro: 5, Master: 999)
 * 4. Post-flight race quota enforcement at acceptance time
 * 5. Tampered token hashes, SQLi payloads, malformed inputs, and 256-bit CSPRNG collision resistance
 *
 * @module __tests__/integration/enterprise/invitations-stress.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import {
  createOrgInvitation,
  acceptOrgInvitation,
  revokeOrgInvitation,
} from '@/tree/organizations/invitation-service';
import {
  checkSeatQuota,
} from '@/tree/organizations/seat-quota-engine';
import {
  generateInvitationToken,
  sha256Hex,
  isTokenExpired,
  INVITATION_TTL_MS,
} from '@/seed/security/invitation-token';
import { getMaxSeatsForTier, TIER_SEAT_LIMITS } from '@/seed/config/tiers/seat-quotas';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => any;
};

describe('Adversarial Stress: Milestone 2 Seat Quotas & Invitation Token Lifecycle', () => {
  let rawDb: any;
  let db: any;
  const ownerUserId = 'usr_owner_root';
  const orgId = 'org_enterprise_stress';

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE,
        tier TEXT NOT NULL DEFAULT 'pro',
        max_seats INTEGER NOT NULL DEFAULT 5,
        status TEXT NOT NULL DEFAULT 'active'
      );

      CREATE TABLE organization_members (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (org_id, user_id)
      );

      CREATE TABLE org_invitations (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL CHECK (
          role IN ('owner', 'admin', 'creator', 'billing_manager', 'viewer')
        ),
        token_hash TEXT UNIQUE NOT NULL,
        expires_at INTEGER NOT NULL,
        accepted_at INTEGER DEFAULT NULL,
        created_by TEXT NOT NULL,
        invited_by TEXT GENERATED ALWAYS AS (created_by) VIRTUAL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (
          status IN ('pending', 'accepted', 'revoked', 'expired')
        )
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uidx_org_invitations_token_hash 
        ON org_invitations(token_hash);

      CREATE INDEX IF NOT EXISTS idx_org_invitations_org_status 
        ON org_invitations(org_id, status);

      CREATE UNIQUE INDEX IF NOT EXISTS uidx_org_invitations_active_email 
        ON org_invitations(org_id, email) 
        WHERE status = 'pending';

      CREATE VIEW IF NOT EXISTS organization_invitations AS 
        SELECT * FROM org_invitations;

      INSERT INTO organizations (id, name, slug, tier, max_seats)
      VALUES ('${orgId}', 'Enterprise Stress Org', 'ent-stress', 'pro', 5);

      INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
      VALUES ('mem_owner', '${orgId}', '${ownerUserId}', 'owner', 1000, 1000);
    `);
    db = makeD1(rawDb);
  });

  // ============================================================================
  // SUITE 1: CONCURRENT RACE CONDITIONS ON TOKEN ACCEPTANCE
  // ============================================================================
  describe('1. Concurrent Token Acceptance Race Condition Attacks', () => {
    it('empirical challenge: ensures CAS strictly permits exactly ONE acceptance under 10 concurrent distinct users', async () => {
      const invite = await createOrgInvitation(db, {
        orgId,
        email: 'race-target@agency.com',
        role: 'creator',
        invitedByUserId: ownerUserId,
      });

      // 10 distinct attacker accounts attempting to race-consume the single invitation token simultaneously
      const concurrency = 10;
      const promises = Array.from({ length: concurrency }, (_, i) =>
        acceptOrgInvitation(db, invite.token, `usr_attacker_${i}`),
      );

      const settled = await Promise.allSettled(promises);

      const fulfilled = settled.filter((r) => r.status === 'fulfilled');
      const rejected = settled.filter((r) => r.status === 'rejected');

      // CRITICAL CAS INVARIANT: Exactly 1 acceptance must succeed; all others must be rejected
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(concurrency - 1);

      // Verify that rejected calls threw INVITATION_ALREADY_USED or similar
      for (const r of rejected) {
        if (r.status === 'rejected') {
          expect(String(r.reason)).toMatch(/INVITATION_ALREADY_USED|SEAT_QUOTA_EXCEEDED/);
        }
      }

      // CRITICAL DATABASE INVARIANT: In organization_members, exactly 1 new member was added (total members = 2)
      const members = rawDb
        .prepare('SELECT * FROM organization_members WHERE org_id = ?')
        .all(orgId) as any[];

      expect(members.length).toBe(2); // 1 owner + 1 accepted invitee

      // Invitation status must be 'accepted'
      const invRow = rawDb
        .prepare('SELECT status, accepted_at FROM org_invitations WHERE id = ?')
        .get(invite.invitationId) as any;

      expect(invRow.status).toBe('accepted');
      expect(invRow.accepted_at).toBeGreaterThan(0);
    });

    it('empirical challenge: simulated edge latency exposes lack of atomic CAS (double acceptance vulnerability)', async () => {
      // Create a D1 wrapper that introduces realistic async edge latency (5ms)
      const asyncDb: any = {
        prepare: (sql: string) => {
          const inner: any = db.prepare(sql);
          return {
            bind: (...params: unknown[]) => {
              const bound: any = inner.bind(...params);
              return {
                first: async <T>() => {
                  await new Promise((r) => setTimeout(r, 5));
                  return bound.first() as T;
                },
                run: async () => {
                  await new Promise((r) => setTimeout(r, 5));
                  return bound.run();
                },
                all: async <T>() => {
                  await new Promise((r) => setTimeout(r, 5));
                  return bound.all() as T;
                },
              };
            },
            first: async <T>() => {
              await new Promise((r) => setTimeout(r, 5));
              return inner.first() as T;
            },
            run: async () => {
              await new Promise((r) => setTimeout(r, 5));
              return inner.run();
            },
            all: async <T>() => {
              await new Promise((r) => setTimeout(r, 5));
              return inner.all() as T;
            },
          };
        },
        exec: db.exec,
        batch: db.batch,
      };

      const invite = await createOrgInvitation(asyncDb, {
        orgId,
        email: 'latency-target@agency.com',
        role: 'creator',
        invitedByUserId: ownerUserId,
      });

      // 5 concurrent users attempt to accept the same token under realistic edge network latency
      const concurrency = 5;
      const promises = Array.from({ length: concurrency }, (_, i) =>
        acceptOrgInvitation(asyncDb, invite.token, `usr_latency_attacker_${i}`),
      );

      const settled = await Promise.allSettled(promises);
      const fulfilled = settled.filter((r) => r.status === 'fulfilled');

      // CRITICAL: In a secure CAS implementation, EXACTLY 1 must succeed
      expect(fulfilled.length).toBe(1);

      // And exactly 1 member must be added in database
      const newMembers = rawDb
        .prepare("SELECT * FROM organization_members WHERE user_id LIKE 'usr_latency_attacker_%'")
        .all() as any[];

      expect(newMembers.length).toBe(1);
    });

    it('empirical challenge: concurrent token acceptance breaches max_seats under edge latency', async () => {
      // Pro org with max 5 seats. Owner + 3 members = 4 members (1 seat left).
      for (let i = 1; i <= 3; i++) {
        rawDb
          .prepare(
            'INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(`mem_edge_pre_${i}`, orgId, `usr_edge_pre_${i}`, 'creator', 1000, 1000);
      }

      const asyncDb: any = {
        prepare: (sql: string) => {
          const inner: any = db.prepare(sql);
          return {
            bind: (...params: unknown[]) => {
              const bound: any = inner.bind(...params);
              return {
                first: async <T>() => {
                  await new Promise((r) => setTimeout(r, 5));
                  return bound.first() as T;
                },
                run: async () => {
                  await new Promise((r) => setTimeout(r, 5));
                  return bound.run();
                },
                all: async <T>() => {
                  await new Promise((r) => setTimeout(r, 5));
                  return bound.all() as T;
                },
              };
            },
            first: async <T>() => {
              await new Promise((r) => setTimeout(r, 5));
              return inner.first() as T;
            },
            run: async () => {
              await new Promise((r) => setTimeout(r, 5));
              return inner.run();
            },
            all: async <T>() => {
              await new Promise((r) => setTimeout(r, 5));
              return inner.all() as T;
            },
          };
        },
        exec: db.exec,
        batch: db.batch,
      };

      const invite = await createOrgInvitation(asyncDb, {
        orgId,
        email: 'quota-breach@agency.com',
        role: 'creator',
        invitedByUserId: ownerUserId,
      });

      // 4 attackers race for the single remaining slot using the single token
      const promises = Array.from({ length: 4 }, (_, i) =>
        acceptOrgInvitation(asyncDb, invite.token, `usr_quota_breacher_${i}`),
      );

      await Promise.allSettled(promises);

      const totalMembers = rawDb
        .prepare('SELECT COUNT(*) AS count FROM organization_members WHERE org_id = ?')
        .get(orgId) as any;

      // In a sound system, total members must NEVER exceed max_seats (5)
      expect(Number(totalMembers.count)).toBeLessThanOrEqual(5);
    });

    it('empirical challenge: ensures concurrent duplicate acceptance by the SAME user allows only 1 success', async () => {

      const invite = await createOrgInvitation(db, {
        orgId,
        email: 'same-user-spam@agency.com',
        role: 'viewer',
        invitedByUserId: ownerUserId,
      });

      const spammerUserId = 'usr_spammer_999';
      const concurrency = 8;
      const promises = Array.from({ length: concurrency }, () =>
        acceptOrgInvitation(db, invite.token, spammerUserId),
      );

      const settled = await Promise.allSettled(promises);
      const fulfilled = settled.filter((r) => r.status === 'fulfilled');

      expect(fulfilled.length).toBe(1);

      const members = rawDb
        .prepare('SELECT * FROM organization_members WHERE org_id = ? AND user_id = ?')
        .all(orgId, spammerUserId) as any[];

      expect(members.length).toBe(1);
    });

    it('empirical challenge: concurrent acceptance racing with revocation maintains safe terminal state', async () => {
      const invite = await createOrgInvitation(db, {
        orgId,
        email: 'race-revoke@agency.com',
        role: 'creator',
        invitedByUserId: ownerUserId,
      });

      // 5 accept attempts racing against 5 revoke attempts
      const accepts = Array.from({ length: 5 }, (_, i) =>
        acceptOrgInvitation(db, invite.token, `usr_racer_${i}`),
      );
      const revokes = Array.from({ length: 5 }, () =>
        revokeOrgInvitation(db, invite.invitationId, orgId),
      );

      const all = await Promise.allSettled([...accepts, ...revokes]);

      const invRow = rawDb
        .prepare('SELECT status FROM org_invitations WHERE id = ?')
        .get(invite.invitationId) as any;

      // Status must be either 'accepted' or 'revoked', never 'pending'
      expect(['accepted', 'revoked']).toContain(invRow.status);

      // If accepted, exactly 1 member was added; if revoked, 0 members were added
      const newMembers = rawDb
        .prepare("SELECT * FROM organization_members WHERE org_id = ? AND user_id != 'usr_owner_root'")
        .all(orgId) as any[];

      if (invRow.status === 'accepted') {
        expect(newMembers.length).toBe(1);
      } else {
        expect(newMembers.length).toBe(0);
      }
    });

    it('empirical challenge: concurrent acceptance cannot breach max_seats when 1 seat remains', async () => {
      // Pro org has max 5 seats. Owner occupies 1. Pre-fill 3 seats -> 4 members total (1 seat left).
      for (let i = 1; i <= 3; i++) {
        rawDb
          .prepare(
            'INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(`mem_prefill_${i}`, orgId, `usr_prefill_${i}`, 'creator', 1000, 1000);
      }

      const invite = await createOrgInvitation(db, {
        orgId,
        email: 'last-seat-target@agency.com',
        role: 'creator',
        invitedByUserId: ownerUserId,
      });

      // 10 concurrent requests rush for that 1 remaining seat
      const promises = Array.from({ length: 10 }, (_, i) =>
        acceptOrgInvitation(db, invite.token, `usr_last_seat_racer_${i}`),
      );

      await Promise.allSettled(promises);

      const totalMembers = rawDb
        .prepare('SELECT COUNT(*) AS count FROM organization_members WHERE org_id = ?')
        .get(orgId) as any;

      // Total members must NEVER exceed max_seats (5)
      expect(Number(totalMembers.count)).toBeLessThanOrEqual(5);
    });
  });

  // ============================================================================
  // SUITE 2: EXPIRED TOKENS & TTL LIFECYCLE BOUNDARY
  // ============================================================================
  describe('2. Expired Token Lifecycle & TTL Boundary Probing', () => {
    it('rejects acceptance on token expired > 7 days and transitions DB status to expired', async () => {
      const invite = await createOrgInvitation(db, {
        orgId,
        email: 'expired-test@agency.com',
        role: 'viewer',
        invitedByUserId: ownerUserId,
      });

      // Artificially expire token by setting expires_at to 8 days ago
      const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
      rawDb
        .prepare('UPDATE org_invitations SET expires_at = ? WHERE id = ?')
        .run(eightDaysAgo, invite.invitationId);

      await expect(
        acceptOrgInvitation(db, invite.token, 'usr_late_buyer'),
      ).rejects.toThrow(/INVITATION_EXPIRED/);

      // Verify row status mutated to 'expired'
      const row = rawDb
        .prepare('SELECT status FROM org_invitations WHERE id = ?')
        .get(invite.invitationId) as any;

      expect(row.status).toBe('expired');

      // Member must NOT be added
      const member = rawDb
        .prepare('SELECT * FROM organization_members WHERE user_id = ?')
        .get('usr_late_buyer');
      expect(member).toBeUndefined();
    });

    it('rejects acceptance on token that expired 1 millisecond ago (sub-millisecond precision)', async () => {
      const invite = await createOrgInvitation(db, {
        orgId,
        email: 'sub-ms-test@agency.com',
        role: 'viewer',
        invitedByUserId: ownerUserId,
      });

      // Expire exactly 1 ms ago
      rawDb
        .prepare('UPDATE org_invitations SET expires_at = ? WHERE id = ?')
        .run(Date.now() - 1, invite.invitationId);

      await expect(
        acceptOrgInvitation(db, invite.token, 'usr_sub_ms'),
      ).rejects.toThrow(/INVITATION_EXPIRED/);
    });

    it('expired invitations do NOT consume seat quota, freeing capacity for new invites', async () => {
      // Pro tier (max 5 seats). Fill 4 members: 1 owner + 3 active members.
      for (let i = 1; i <= 3; i++) {
        rawDb
          .prepare(
            'INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(`mem_quota_${i}`, orgId, `usr_quota_${i}`, 'creator', 1000, 1000);
      }

      // Create an invitation (allocated = 4 + 1 = 5)
      const invite1 = await createOrgInvitation(db, {
        orgId,
        email: 'stale1@agency.com',
        role: 'creator',
        invitedByUserId: ownerUserId,
      });

      // Now org is full (5/5). Verify 2nd invite is blocked
      await expect(
        createOrgInvitation(db, {
          orgId,
          email: 'stale2@agency.com',
          role: 'creator',
          invitedByUserId: ownerUserId,
        }),
      ).rejects.toThrow(/SEAT_QUOTA_EXCEEDED/);

      // Artificially expire invite1
      rawDb
        .prepare('UPDATE org_invitations SET expires_at = ? WHERE id = ?')
        .run(Date.now() - 5000, invite1.invitationId);

      // checkSeatQuota should now report pendingInvites = 0, allocated = 4, isAllowed = true
      const quota = await checkSeatQuota(db, orgId);
      expect(quota.pendingInvites).toBe(0);
      expect(quota.allocated).toBe(4);
      expect(quota.isAllowed).toBe(true);

      // Creating a new invite now MUST succeed
      const freshInvite = await createOrgInvitation(db, {
        orgId,
        email: 'fresh@agency.com',
        role: 'creator',
        invitedByUserId: ownerUserId,
      });
      expect(freshInvite.token).toBeDefined();
    });

    it('isTokenExpired utility correctly evaluates boundaries', () => {
      const now = 1700000000000;
      expect(isTokenExpired(now - 1, now)).toBe(true);
      expect(isTokenExpired(now, now)).toBe(false);
      expect(isTokenExpired(now + 1, now)).toBe(false);
      expect(isTokenExpired(now + INVITATION_TTL_MS, now)).toBe(false);
    });
  });

  // ============================================================================
  // SUITE 3: SEAT QUOTA OVERSUBSCRIPTION ATTACKS
  // ============================================================================
  describe('3. Seat Quota Oversubscription Across All Tiers', () => {
    it('Free Tier (1 seat): blocks invitation creation when owner exists', async () => {
      const freeOrgId = 'org_tier_free';
      rawDb.exec(`
        INSERT INTO organizations (id, name, slug, tier, max_seats)
        VALUES ('${freeOrgId}', 'Free Org', 'free-org', 'free', 1);

        INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
        VALUES ('mem_free_owner', '${freeOrgId}', 'usr_free_owner', 'owner', 1000, 1000);
      `);

      const quota = await checkSeatQuota(db, freeOrgId);
      expect(quota.maxSeats).toBe(1);
      expect(quota.activeMembers).toBe(1);
      expect(quota.isAllowed).toBe(false);

      await expect(
        createOrgInvitation(db, {
          orgId: freeOrgId,
          email: 'overflow@free.com',
          role: 'viewer',
          invitedByUserId: 'usr_free_owner',
        }),
      ).rejects.toThrow(/SEAT_QUOTA_EXCEEDED/);
    });

    it('Starter Tier (1 seat): blocks invitation creation when owner exists', async () => {
      const starterOrgId = 'org_tier_starter';
      rawDb.exec(`
        INSERT INTO organizations (id, name, slug, tier, max_seats)
        VALUES ('${starterOrgId}', 'Starter Org', 'starter-org', 'starter', 1);

        INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
        VALUES ('mem_starter_owner', '${starterOrgId}', 'usr_starter_owner', 'owner', 1000, 1000);
      `);

      const quota = await checkSeatQuota(db, starterOrgId);
      expect(quota.maxSeats).toBe(1);
      expect(quota.isAllowed).toBe(false);

      await expect(
        createOrgInvitation(db, {
          orgId: starterOrgId,
          email: 'overflow@starter.com',
          role: 'viewer',
          invitedByUserId: 'usr_starter_owner',
        }),
      ).rejects.toThrow(/SEAT_QUOTA_EXCEEDED/);
    });

    it('Pro Tier (5 seats): strictly blocks creation on 5th member + pending', async () => {
      // Owner + 3 members = 4 members.
      for (let i = 1; i <= 3; i++) {
        rawDb
          .prepare(
            'INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(`mem_p_${i}`, orgId, `usr_p_${i}`, 'creator', 1000, 1000);
      }

      // Slot 5: 1 invite
      await createOrgInvitation(db, {
        orgId,
        email: 'slot5@pro.com',
        role: 'creator',
        invitedByUserId: ownerUserId,
      });

      // Slot 6: Should be blocked
      await expect(
        createOrgInvitation(db, {
          orgId,
          email: 'slot6@pro.com',
          role: 'creator',
          invitedByUserId: ownerUserId,
        }),
      ).rejects.toThrow(/SEAT_QUOTA_EXCEEDED/);
    });

    it('Master Tier (999 seats): permits large scale membership', async () => {
      const masterOrgId = 'org_tier_master';
      rawDb.exec(`
        INSERT INTO organizations (id, name, slug, tier, max_seats)
        VALUES ('${masterOrgId}', 'Master Org', 'master-org', 'master', 999);

        INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
        VALUES ('mem_master_owner', '${masterOrgId}', 'usr_master_owner', 'owner', 1000, 1000);
      `);

      const quota = await checkSeatQuota(db, masterOrgId);
      expect(quota.maxSeats).toBe(999);
      expect(quota.isAllowed).toBe(true);

      const invite = await createOrgInvitation(db, {
        orgId: masterOrgId,
        email: 'member@master.com',
        role: 'admin',
        invitedByUserId: 'usr_master_owner',
      });
      expect(invite.token).toBeDefined();
    });

    it('Tier normalization: handles case variations (PRO, pro, Master, basic)', () => {
      expect(getMaxSeatsForTier('pro')).toBe(5);
      expect(getMaxSeatsForTier('PRO')).toBe(5);
      expect(getMaxSeatsForTier('Pro')).toBe(5);
      expect(getMaxSeatsForTier('master')).toBe(999);
      expect(getMaxSeatsForTier('MASTER')).toBe(999);
      expect(getMaxSeatsForTier('free')).toBe(1);
      expect(getMaxSeatsForTier('starter')).toBe(1);
      expect(getMaxSeatsForTier(null)).toBe(1);
      expect(getMaxSeatsForTier(undefined)).toBe(1);
      expect(getMaxSeatsForTier('unknown_tier')).toBe(1);
    });

    it('post-flight quota check at acceptance time: blocks acceptance if seats were filled after invite was issued', async () => {
      // Pro org has 1 owner (1/5). Issue an invitation.
      const invite = await createOrgInvitation(db, {
        orgId,
        email: 'post-flight-target@agency.com',
        role: 'creator',
        invitedByUserId: ownerUserId,
      });

      // Before invitee accepts, admin adds 4 members directly, filling all 5 seats
      for (let i = 1; i <= 4; i++) {
        rawDb
          .prepare(
            'INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(`mem_fill_${i}`, orgId, `usr_fill_${i}`, 'creator', 1000, 1000);
      }

      // Total members = 5 (maxSeats = 5). Now invitee attempts acceptance.
      await expect(
        acceptOrgInvitation(db, invite.token, 'usr_post_flight_victim'),
      ).rejects.toThrow(/SEAT_QUOTA_EXCEEDED/);

      // Verify member was NOT added
      const member = rawDb
        .prepare('SELECT * FROM organization_members WHERE user_id = ?')
        .get('usr_post_flight_victim');
      expect(member).toBeUndefined();

      // Total members remains exactly 5
      const total = rawDb
        .prepare('SELECT COUNT(*) AS count FROM organization_members WHERE org_id = ?')
        .get(orgId) as any;
      expect(Number(total.count)).toBe(5);
    });

    it('concurrent invitation creation oversubscription attack: rejects creation once capacity reached', async () => {
      // Org has 1 owner (1/5). 4 slots remain.
      // 10 concurrent requests to create invitations with different emails
      const promises = Array.from({ length: 10 }, (_, i) =>
        createOrgInvitation(db, {
          orgId,
          email: `concurrent_invite_${i}@agency.com`,
          role: 'viewer',
          invitedByUserId: ownerUserId,
        }),
      );

      const settled = await Promise.allSettled(promises);
      const fulfilled = settled.filter((r) => r.status === 'fulfilled');

      // Regardless of scheduling, total allocated (active + pending) in DB must never exceed maxSeats (5)
      const countPending = rawDb
        .prepare("SELECT COUNT(*) AS count FROM org_invitations WHERE org_id = ? AND status = 'pending'")
        .get(orgId) as any;
      const countActive = rawDb
        .prepare('SELECT COUNT(*) AS count FROM organization_members WHERE org_id = ?')
        .get(orgId) as any;

      const totalAllocated = Number(countPending.count) + Number(countActive.count);
      // In a strict quota system, totalAllocated must not exceed 5
      // If concurrent creations both passed the check before either committed, report finding
      expect(totalAllocated).toBeLessThanOrEqual(5);
    });
  });

  // ============================================================================
  // SUITE 4: TAMPERED TOKEN HASHES & COLLISION RESISTANCE
  // ============================================================================
  describe('4. Tampered Token Hashes, SQLi, and Cryptographic Entropy', () => {
    it('rejects single-character tampered token (bit flip attack)', async () => {
      const invite = await createOrgInvitation(db, {
        orgId,
        email: 'tamper@agency.com',
        role: 'viewer',
        invitedByUserId: ownerUserId,
      });

      // Tamper 1 character: flip the first char (if 'a' -> 'b', otherwise 'a')
      const firstChar = invite.token[0];
      const tamperedChar = firstChar === 'a' ? 'b' : 'a';
      const tamperedToken = tamperedChar + invite.token.slice(1);

      await expect(
        acceptOrgInvitation(db, tamperedToken, 'usr_attacker'),
      ).rejects.toThrow(/INVALID_INVITATION_TOKEN/);
    });

    it('rejects passing raw tokenHash as the token argument (pre-image defense)', async () => {
      const invite = await createOrgInvitation(db, {
        orgId,
        email: 'hash-replay@agency.com',
        role: 'viewer',
        invitedByUserId: ownerUserId,
      });

      const tokenHash = await sha256Hex(invite.token);

      // Attempting to pass the DB-stored hash as the token must fail
      await expect(
        acceptOrgInvitation(db, tokenHash, 'usr_attacker'),
      ).rejects.toThrow(/INVALID_INVITATION_TOKEN/);
    });

    it('resists SQL injection payloads and malformed token inputs', async () => {
      const injectionPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE org_invitations; --",
        "' UNION SELECT * FROM org_invitations --",
        '<script>alert("XSS")</script>',
        '\\0\\x00nullbyte',
        '',
        '   ',
        'short',
        'a'.repeat(32),   // 32 chars instead of 64
        'f'.repeat(128),  // 128 chars
        'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz', // 64 non-hex chars
      ];

      for (const payload of injectionPayloads) {
        await expect(
          acceptOrgInvitation(db, payload, 'usr_sqli_tester'),
        ).rejects.toThrow(/INVALID_INVITATION_TOKEN/);
      }

      // Verify table was not dropped
      const count = rawDb
        .prepare('SELECT COUNT(*) AS count FROM org_invitations')
        .get() as any;
      expect(count).toBeDefined();
    });

    it('256-bit CSPRNG token generator: enforces 64 hex chars and zero collision across 2,000 generations', async () => {
      const SAMPLE_SIZE = 2000;
      const rawTokens = new Set<string>();
      const tokenHashes = new Set<string>();

      for (let i = 0; i < SAMPLE_SIZE; i++) {
        const tokenObj = await generateInvitationToken();

        // 1. Length & format check: exactly 64 lowercase hex chars
        expect(tokenObj.rawToken).toMatch(/^[0-9a-f]{64}$/);
        expect(tokenObj.tokenHash).toMatch(/^[0-9a-f]{64}$/);

        // 2. Hash integrity check: sha256Hex(rawToken) === tokenHash
        const recomputed = await sha256Hex(tokenObj.rawToken);
        expect(recomputed).toBe(tokenObj.tokenHash);

        // 3. Collect for collision detection
        rawTokens.add(tokenObj.rawToken);
        tokenHashes.add(tokenObj.tokenHash);
      }

      // Zero collisions guaranteed across 2,000 generated tokens
      expect(rawTokens.size).toBe(SAMPLE_SIZE);
      expect(tokenHashes.size).toBe(SAMPLE_SIZE);
    });

    it('enforces partial unique index: duplicate pending invitations for same email in same org are blocked', async () => {
      await createOrgInvitation(db, {
        orgId,
        email: 'duplicate-check@agency.com',
        role: 'creator',
        invitedByUserId: ownerUserId,
      });

      // Creating a second pending invitation for the same email in the same org must fail
      await expect(
        createOrgInvitation(db, {
          orgId,
          email: 'duplicate-check@agency.com',
          role: 'viewer',
          invitedByUserId: ownerUserId,
        }),
      ).rejects.toThrow();
    });
  });
});

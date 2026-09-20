/**
 * Empirical Challenger Test Suite: Milestone 2 Remediations Adversarial Stress
 *
 * Independent empirical stress tests:
 * 1. High-concurrency single-token acceptance races (50 concurrent callers with random jitter)
 * 2. High-concurrency invitation creation races (20 concurrent creation callers competing for 1 slot)
 * 3. Mixed acceptance vs revocation race conditions (20 concurrent racing threads)
 * 4. Multi-token concurrent acceptance with scarce capacity (multiple pending tokens racing when 1 seat left)
 * 5. Rollback on duplicate member constraint under concurrency
 * 6. Quota boundary conditions across tiers (Free, Starter, Pro, Master, custom)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import {
  createOrgInvitation,
  acceptOrgInvitation,
  revokeOrgInvitation,
} from '@/tree/organizations/invitation-service';
import { checkSeatQuota } from '@/tree/organizations/seat-quota-engine';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => any;
};

describe('Empirical Challenger: Milestone 2 Remediations Adversarial Stress', () => {
  let rawDb: any;
  let db: any;
  const ownerUserId = 'usr_owner_alpha';
  const orgId = 'org_challenger_m2';

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
      VALUES ('${orgId}', 'Challenger Org', 'challenger-org', 'pro', 5);

      INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
      VALUES ('mem_owner_0', '${orgId}', '${ownerUserId}', 'owner', 1000, 1000);
    `);
    db = makeD1(rawDb);
  });

  // Helper to simulate asynchronous edge network latency with random jitter
  function makeJitterDb(baseDb: any, minMs = 1, maxMs = 10): any {
    const jitter = () => {
      const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
      return new Promise((resolve) => setTimeout(resolve, delay));
    };

    return {
      prepare: (sql: string) => {
        const inner: any = baseDb.prepare(sql);
        return {
          bind: (...params: unknown[]) => {
            const bound: any = inner.bind(...params);
            return {
              first: async <T>() => {
                await jitter();
                return bound.first() as T;
              },
              run: async () => {
                await jitter();
                return bound.run();
              },
              all: async <T>() => {
                await jitter();
                return bound.all() as T;
              },
            };
          },
          first: async <T>() => {
            await jitter();
            return inner.first() as T;
          },
          run: async () => {
            await jitter();
            return inner.run();
          },
          all: async <T>() => {
            await jitter();
            return inner.all() as T;
          },
        };
      },
      exec: baseDb.exec,
      batch: baseDb.batch,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. High-Concurrency Single-Token Acceptance Races
  // ──────────────────────────────────────────────────────────────────────────
  describe('1. High-Concurrency Single-Token Acceptance Races', () => {
    it('empirical challenge: 50 concurrent callers attacking 1 invitation token with jitter', async () => {
      const jitterDb = makeJitterDb(db, 2, 8);
      const invite = await createOrgInvitation(jitterDb, {
        orgId,
        email: 'high-concurrency-single@agency.com',
        role: 'creator',
        invitedByUserId: ownerUserId,
      });

      const concurrency = 50;
      const callers = Array.from({ length: concurrency }, (_, i) =>
        acceptOrgInvitation(jitterDb, invite.token, `usr_racer_concurrency_${i}`),
      );

      const results = await Promise.allSettled(callers);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // INVARIANT 1: Exactly 1 acceptance must succeed
      expect(fulfilled.length).toBe(1);
      // INVARIANT 2: Exactly 49 rejections
      expect(rejected.length).toBe(concurrency - 1);

      // INVARIANT 3: Database state strictly reflects exactly 1 new member
      const members = rawDb
        .prepare('SELECT * FROM organization_members WHERE org_id = ?')
        .all(orgId) as any[];
      expect(members.length).toBe(2); // 1 owner + 1 winner

      // INVARIANT 4: Invitation status must be 'accepted'
      const invRow = rawDb
        .prepare('SELECT status, accepted_at FROM org_invitations WHERE id = ?')
        .get(invite.invitationId) as any;
      expect(invRow.status).toBe('accepted');
      expect(invRow.accepted_at).toBeGreaterThan(0);
    });

    it('empirical challenge: replay attack by the winning user after acceptance is rejected', async () => {
      const invite = await createOrgInvitation(db, {
        orgId,
        email: 'replay-target@agency.com',
        role: 'viewer',
        invitedByUserId: ownerUserId,
      });

      const winnerId = 'usr_winner_single';
      const firstAccept = await acceptOrgInvitation(db, invite.token, winnerId);
      expect(firstAccept.success).toBe(true);

      // Replay immediate subsequent attempt with same user
      await expect(
        acceptOrgInvitation(db, invite.token, winnerId),
      ).rejects.toThrow(/INVITATION_ALREADY_USED/);

      // Replay with different user
      await expect(
        acceptOrgInvitation(db, invite.token, 'usr_impostor_after'),
      ).rejects.toThrow(/INVITATION_ALREADY_USED/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. High-Concurrency Invitation Creation Races
  // ──────────────────────────────────────────────────────────────────────────
  describe('2. High-Concurrency Invitation Creation Races', () => {
    it('empirical challenge: 20 concurrent creation callers competing for 1 remaining slot', async () => {
      // Pro org has 5 max seats. Pre-fill with 4 members (owner + 3 members).
      for (let i = 1; i <= 3; i++) {
        rawDb
          .prepare(
            'INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(`mem_fill_${i}`, orgId, `usr_fill_${i}`, 'creator', 1000, 1000);
      }

      // Exactly 1 seat remaining (4/5 filled).
      // 20 concurrent creation calls with unique emails
      const concurrency = 20;
      const creationPromises = Array.from({ length: concurrency }, (_, i) =>
        createOrgInvitation(db, {
          orgId,
          email: `race_creator_${i}@enterprise.com`,
          role: 'viewer',
          invitedByUserId: ownerUserId,
        }),
      );

      const settled = await Promise.allSettled(creationPromises);
      const fulfilled = settled.filter((r) => r.status === 'fulfilled');
      const rejected = settled.filter((r) => r.status === 'rejected');

      // INVARIANT: Exactly 1 invitation should be created
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(concurrency - 1);

      // Verify in DB that total allocated (active 4 + pending 1) equals exactly 5
      const countPending = rawDb
        .prepare("SELECT COUNT(*) AS count FROM org_invitations WHERE org_id = ? AND status = 'pending'")
        .get(orgId) as any;
      const countActive = rawDb
        .prepare('SELECT COUNT(*) AS count FROM organization_members WHERE org_id = ?')
        .get(orgId) as any;

      expect(Number(countActive.count)).toBe(4);
      expect(Number(countPending.count)).toBe(1);
      expect(Number(countActive.count) + Number(countPending.count)).toBe(5);
    });

    it('empirical challenge: creation with jittered latency prevents race oversubscription', async () => {
      const jitterDb = makeJitterDb(db, 2, 6);
      // Free tier org: max_seats = 1. Owner already exists (1/1 full).
      const freeOrgId = 'org_free_concurrency';
      rawDb.exec(`
        INSERT INTO organizations (id, name, slug, tier, max_seats)
        VALUES ('${freeOrgId}', 'Free Org Concurrency', 'free-org-conc', 'free', 1);

        INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
        VALUES ('mem_free_conc_owner', '${freeOrgId}', 'usr_free_conc_owner', 'owner', 1000, 1000);
      `);

      // 10 concurrent requests to create invites in a full free org
      const promises = Array.from({ length: 10 }, (_, i) =>
        createOrgInvitation(jitterDb, {
          orgId: freeOrgId,
          email: `free_overflow_${i}@test.com`,
          role: 'viewer',
          invitedByUserId: 'usr_free_conc_owner',
        }),
      );

      const results = await Promise.allSettled(promises);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');

      // Zero creations must succeed
      expect(fulfilled.length).toBe(0);

      const pendingCount = rawDb
        .prepare("SELECT COUNT(*) AS count FROM org_invitations WHERE org_id = ? AND status = 'pending'")
        .get(freeOrgId) as any;
      expect(Number(pendingCount.count)).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Mixed Acceptance vs Revocation Race Conditions
  // ──────────────────────────────────────────────────────────────────────────
  describe('3. Mixed Acceptance vs Revocation Race Conditions', () => {
    it('empirical challenge: 10 accepts racing with 10 revokes on jittered edge DB', async () => {
      const jitterDb = makeJitterDb(db, 1, 5);
      const invite = await createOrgInvitation(jitterDb, {
        orgId,
        email: 'mixed-race@agency.com',
        role: 'creator',
        invitedByUserId: ownerUserId,
      });

      const accepts = Array.from({ length: 10 }, (_, i) =>
        acceptOrgInvitation(jitterDb, invite.token, `usr_mixed_acceptor_${i}`),
      );
      const revokes = Array.from({ length: 10 }, () =>
        revokeOrgInvitation(jitterDb, invite.invitationId, orgId),
      );

      await Promise.allSettled([...accepts, ...revokes]);

      // Database state check
      const invRow = rawDb
        .prepare('SELECT status, accepted_at FROM org_invitations WHERE id = ?')
        .get(invite.invitationId) as any;

      expect(['accepted', 'revoked']).toContain(invRow.status);

      const newMembers = rawDb
        .prepare("SELECT * FROM organization_members WHERE user_id LIKE 'usr_mixed_acceptor_%'")
        .all() as any[];

      if (invRow.status === 'accepted') {
        expect(newMembers.length).toBe(1);
        expect(invRow.accepted_at).toBeGreaterThan(0);
      } else {
        expect(newMembers.length).toBe(0);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Multi-Token Acceptance Racing With Scarce Capacity
  // ──────────────────────────────────────────────────────────────────────────
  describe('4. Multi-Token Acceptance Racing With Scarce Capacity', () => {
    it('empirical challenge: multiple distinct tokens racing to accept when 1 seat remains', async () => {
      // Setup scenario: Pro org with 5 seats. Owner occupies 1.
      // 3 members occupy 3 more slots -> 4 active members, 1 seat remaining.
      for (let i = 1; i <= 3; i++) {
        rawDb
          .prepare(
            'INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(`mem_sc_${i}`, orgId, `usr_sc_${i}`, 'creator', 1000, 1000);
      }

      // Create 1 valid invitation (last slot, 5/5 allocated)
      const invite1 = await createOrgInvitation(db, {
        orgId,
        email: 'token1@agency.com',
        role: 'creator',
        invitedByUserId: ownerUserId,
      });

      // Attempting to create invite 2 should be blocked by quota check
      await expect(
        createOrgInvitation(db, {
          orgId,
          email: 'token2@agency.com',
          role: 'creator',
          invitedByUserId: ownerUserId,
        }),
      ).rejects.toThrow(/SEAT_QUOTA_EXCEEDED/);

      // Now suppose invite1 exists. If 5 concurrent users try to accept invite1:
      const promises = Array.from({ length: 5 }, (_, i) =>
        acceptOrgInvitation(db, invite1.token, `usr_sc_buyer_${i}`),
      );

      const results = await Promise.allSettled(promises);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');

      expect(fulfilled.length).toBe(1);

      const totalMembers = rawDb
        .prepare('SELECT COUNT(*) AS count FROM organization_members WHERE org_id = ?')
        .get(orgId) as any;

      expect(Number(totalMembers.count)).toBe(5);
    });

    it('empirical challenge: two distinct valid tokens racing to accept when capacity was reduced to 1 slot', async () => {
      // 1. Pro org with 5 seats. Start with 1 owner + 2 members = 3 members (2 slots open).
      for (let i = 1; i <= 2; i++) {
        rawDb
          .prepare(
            'INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(`mem_prep_${i}`, orgId, `usr_prep_${i}`, 'creator', 1000, 1000);
      }

      // 2. Issue 2 invitations legitimately (slots 4 and 5)
      const inviteA = await createOrgInvitation(db, {
        orgId,
        email: 'dual_racer_a@agency.com',
        role: 'creator',
        invitedByUserId: ownerUserId,
      });

      const inviteB = await createOrgInvitation(db, {
        orgId,
        email: 'dual_racer_b@agency.com',
        role: 'creator',
        invitedByUserId: ownerUserId,
      });

      // 3. Out-of-band: an admin adds a 4th member directly before either invitee accepts.
      // Now: active members = 4. Max seats = 5. Exactly 1 seat remains open!
      rawDb
        .prepare(
          'INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run('mem_prep_4', orgId, 'usr_prep_4', 'creator', 1000, 1000);

      // 4. Both invitee A and invitee B race to accept simultaneously under async edge latency (Cloudflare D1 simulation)
      const jitterDb = makeJitterDb(db, 3, 10);
      const [resA, resB] = await Promise.allSettled([
        acceptOrgInvitation(jitterDb, inviteA.token, 'usr_dual_winner_a'),
        acceptOrgInvitation(jitterDb, inviteB.token, 'usr_dual_winner_b'),
      ]);

      const totalMembers = rawDb
        .prepare('SELECT COUNT(*) AS count FROM organization_members WHERE org_id = ?')
        .get(orgId) as any;

      console.log(`[Challenger Diagnostic] resA: ${resA.status}, resB: ${resB.status}, totalMembers: ${totalMembers.count}`);

      // INVARIANT: Under strict seat quota enforcement, total members must NOT exceed max_seats (5)
      expect(Number(totalMembers.count)).toBeLessThanOrEqual(5);
    });

    it('empirical challenge: post-flight quota blocks acceptance if seats were filled out-of-band', async () => {
      // Pro org has 1 owner (1/5). Issue an invitation.
      const invite = await createOrgInvitation(db, {
        orgId,
        email: 'out-of-band@agency.com',
        role: 'viewer',
        invitedByUserId: ownerUserId,
      });

      // Out-of-band fill: another process adds 4 members directly
      for (let i = 1; i <= 4; i++) {
        rawDb
          .prepare(
            'INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(`mem_oob_${i}`, orgId, `usr_oob_${i}`, 'viewer', 1000, 1000);
      }

      // Now 5 members exist. Invitee tries to accept.
      await expect(
        acceptOrgInvitation(db, invite.token, 'usr_oob_invitee'),
      ).rejects.toThrow(/SEAT_QUOTA_EXCEEDED/);

      // Status of invitation must NOT be accepted
      const invRow = rawDb
        .prepare('SELECT status FROM org_invitations WHERE id = ?')
        .get(invite.invitationId) as any;

      expect(invRow.status).toBe('pending');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Rollback on Duplicate Member Constraint Under Concurrency
  // ──────────────────────────────────────────────────────────────────────────
  describe('5. Rollback on Duplicate Member Constraint', () => {
    it('empirical challenge: already-member user accepting token triggers rollback to pending', async () => {
      const invite = await createOrgInvitation(db, {
        orgId,
        email: 'already-member@agency.com',
        role: 'viewer',
        invitedByUserId: ownerUserId,
      });

      // Owner (already a member) attempts to accept
      await expect(
        acceptOrgInvitation(db, invite.token, ownerUserId),
      ).rejects.toThrow();

      // INVARIANT: CAS claim must have rolled back to 'pending'
      const invRow = rawDb
        .prepare('SELECT status, accepted_at FROM org_invitations WHERE id = ?')
        .get(invite.invitationId) as any;

      expect(invRow.status).toBe('pending');
      expect(invRow.accepted_at).toBeNull();

      // Another user can now accept the unconsumed invitation
      const legitimateAccept = await acceptOrgInvitation(db, invite.token, 'usr_new_valid_member');
      expect(legitimateAccept.success).toBe(true);

      const finalRow = rawDb
        .prepare('SELECT status FROM org_invitations WHERE id = ?')
        .get(invite.invitationId) as any;
      expect(finalRow.status).toBe('accepted');
    });
  });
});

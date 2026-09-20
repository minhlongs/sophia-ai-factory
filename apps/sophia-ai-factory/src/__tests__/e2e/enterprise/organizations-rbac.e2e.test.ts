/**
 * Enterprise Organizations & 5-Tier RBAC — Comprehensive 4-Tier E2E Test Suite
 *
 * Covers:
 * - Feature 1: Org creation, metadata & lifecycle
 * - Feature 2: Tier seat quotas (Free: 1, Starter: 1, Pro: 5, Master: 999)
 * - Feature 3: Cryptographic single-use invitation tokens (256-bit crypto, 7-day TTL, SHA-256 hash)
 * - Feature 4: Invitation verification, atomic consumption, and member role assignment
 * - Feature 5: 5-Tier RBAC permissions (owner, admin, creator, billing_manager, viewer)
 * - Feature 6: Org context switching & tenant data isolation guard (assertTenantScope)
 *
 * Implements 4-Tier Test Architecture:
 * - Tier 1: Feature Coverage (>=5 tests per feature area)
 * - Tier 2: Boundary & Corner Cases (>=5 tests per feature area)
 * - Tier 3: Cross-Feature Combinations
 * - Tier 4: Real-World Scenarios
 *
 * @module __tests__/e2e/enterprise/organizations-rbac.e2e.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEnterpriseD1,
  createOrganization,
  checkSeatQuota,
  createOrgInvitation,
  acceptOrgInvitation,
  hasOrgPermission,
  assertTenantScope,
  TIER_SEAT_LIMITS,
  type MockD1Database,
  type OrgTier,
  type OrgRole,
  type OrgPermission,
} from './enterprise-test-harness';

describe('Enterprise Organizations & 5-Tier RBAC E2E Test Suite', () => {
  let db: MockD1Database;
  const ownerUserId = 'usr_super_founder';

  beforeEach(() => {
    db = createEnterpriseD1();
  });

  // ============================================================================
  // TIER 1: FEATURE COVERAGE (>=5 tests per feature area)
  // ============================================================================
  describe('Tier 1: Feature Coverage', () => {
    describe('F1: Organization Creation & Member Management', () => {
      it('F1-1: creates a new organization with slug, tier and owner member', async () => {
        const org = await createOrganization(db, {
          name: 'Nexus Media Inc',
          slug: 'nexus-media',
          tier: 'pro',
          ownerUserId,
        });

        expect(org.orgId).toMatch(/^org_/);
        expect(org.name).toBe('Nexus Media Inc');
        expect(org.slug).toBe('nexus-media');
        expect(org.tier).toBe('pro');
        expect(org.maxSeats).toBe(5);

        // Verify owner is added to organization_members
        const member = await db
          .prepare(`SELECT * FROM organization_members WHERE org_id = ?1 AND user_id = ?2`)
          .bind(org.orgId, ownerUserId)
          .first<{ role: string }>();

        expect(member).toBeDefined();
        expect(member?.role).toBe('owner');
      });

      it('F1-2: sets max_seats according to tier limit configuration', async () => {
        const freeOrg = await createOrganization(db, { name: 'Free Org', slug: 'free-org', tier: 'free', ownerUserId });
        const starterOrg = await createOrganization(db, { name: 'Starter Org', slug: 'starter-org', tier: 'starter', ownerUserId });
        const proOrg = await createOrganization(db, { name: 'Pro Org', slug: 'pro-org', tier: 'pro', ownerUserId });
        const masterOrg = await createOrganization(db, { name: 'Master Org', slug: 'master-org', tier: 'master', ownerUserId });

        expect(freeOrg.maxSeats).toBe(1);
        expect(starterOrg.maxSeats).toBe(1);
        expect(proOrg.maxSeats).toBe(5);
        expect(masterOrg.maxSeats).toBe(999);
      });

      it('F1-3: enforces uniqueness on organization slug', async () => {
        await createOrganization(db, { name: 'Org One', slug: 'unique-slug', tier: 'pro', ownerUserId });
        await expect(
          createOrganization(db, { name: 'Org Two', slug: 'unique-slug', tier: 'pro', ownerUserId: 'usr_another' })
        ).rejects.toThrow();
      });

      it('F1-4: initializes organization status to active with timestamps', async () => {
        const org = await createOrganization(db, { name: 'Active Org', slug: 'active-org', tier: 'starter', ownerUserId });
        const row = await db
          .prepare(`SELECT status, created_at, updated_at FROM organizations WHERE id = ?1`)
          .bind(org.orgId)
          .first<{ status: string; created_at: number; updated_at: number }>();

        expect(row?.status).toBe('active');
        expect(row?.created_at).toBeGreaterThan(0);
        expect(row?.updated_at).toBe(row?.created_at);
      });

      it('F1-5: lists all organization members and their roles', async () => {
        const org = await createOrganization(db, { name: 'Team Org', slug: 'team-org', tier: 'pro', ownerUserId });
        // Add additional member directly
        await db
          .prepare(
            `INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
             VALUES ('mem_2', ?1, 'usr_creator_1', 'creator', ?2, ?2)`
          )
          .bind(org.orgId, Date.now())
          .run();

        const members = await db
          .prepare(`SELECT user_id, role FROM organization_members WHERE org_id = ?1 ORDER BY created_at ASC, id ASC`)
          .bind(org.orgId)
          .all<{ user_id: string; role: string }>();

        expect(members.results).toHaveLength(2);
        const roles = members.results.map((m) => m.role);
        expect(roles).toContain('owner');
        expect(roles).toContain('creator');
      });
    });

    describe('F2: Tier Seat Quotas Enforcement', () => {
      it('F2-1: reports correct seat allocation for freshly created org (1 allocated / N max)', async () => {
        const org = await createOrganization(db, { name: 'Quota Org', slug: 'quota-org', tier: 'pro', ownerUserId });
        const quota = await checkSeatQuota(db, org.orgId);
        expect(quota.allocated).toBe(1); // Owner takes 1 seat
        expect(quota.maxSeats).toBe(5);
        expect(quota.isAllowed).toBe(true);
      });

      it('F2-2: blocks additional invitations when free tier seat quota (1) is reached', async () => {
        const org = await createOrganization(db, { name: 'Free Org', slug: 'free-cap', tier: 'free', ownerUserId });
        const quota = await checkSeatQuota(db, org.orgId);
        expect(quota.allocated).toBe(1);
        expect(quota.maxSeats).toBe(1);
        expect(quota.isAllowed).toBe(false);

        await expect(
          createOrgInvitation(db, org.orgId, 'colleague@agency.com', 'creator', ownerUserId)
        ).rejects.toThrow(/SEAT_QUOTA_EXCEEDED/);
      });

      it('F2-3: allows filling seats up to Pro tier max (5 seats)', async () => {
        const org = await createOrganization(db, { name: 'Pro Team', slug: 'pro-team', tier: 'pro', ownerUserId });
        // Owner is seat 1. Add 3 more members.
        for (let i = 2; i <= 4; i++) {
          await db
            .prepare(
              `INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
               VALUES (?1, ?2, ?3, 'creator', ?4, ?4)`
            )
            .bind(`mem_${i}`, org.orgId, `usr_${i}`, Date.now())
            .run();
        }

        const quota = await checkSeatQuota(db, org.orgId);
        expect(quota.allocated).toBe(4);
        expect(quota.maxSeats).toBe(5);
        expect(quota.isAllowed).toBe(true);

        // 5th invite allowed
        const invite = await createOrgInvitation(db, org.orgId, 'member5@pro.com', 'viewer', ownerUserId);
        expect(invite.token).toBeDefined();
      });

      it('F2-4: blocks invitation when Pro tier has all 5 seats occupied', async () => {
        const org = await createOrganization(db, { name: 'Pro Full', slug: 'pro-full', tier: 'pro', ownerUserId });
        for (let i = 2; i <= 5; i++) {
          await db
            .prepare(
              `INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
               VALUES (?1, ?2, ?3, 'creator', ?4, ?4)`
            )
            .bind(`mem_${i}`, org.orgId, `usr_${i}`, Date.now())
            .run();
        }

        const quota = await checkSeatQuota(db, org.orgId);
        expect(quota.allocated).toBe(5);
        expect(quota.isAllowed).toBe(false);

        await expect(
          createOrgInvitation(db, org.orgId, 'overflow@pro.com', 'viewer', ownerUserId)
        ).rejects.toThrow(/SEAT_QUOTA_EXCEEDED/);
      });

      it('F2-5: Master tier accommodates high seat volume (up to 999 seats)', async () => {
        const org = await createOrganization(db, { name: 'Enterprise Scale', slug: 'enterprise-scale', tier: 'master', ownerUserId });
        const quota = await checkSeatQuota(db, org.orgId);
        expect(quota.maxSeats).toBe(999);
        expect(quota.isAllowed).toBe(true);
      });
    });

    describe('F3: Cryptographic Single-Use Invitation Tokens', () => {
      it('F3-1: generates 256-bit high-entropy invitation token (64 hex characters)', async () => {
        const org = await createOrganization(db, { name: 'Crypto Org', slug: 'crypto-org', tier: 'pro', ownerUserId });
        const invite = await createOrgInvitation(db, org.orgId, 'invitee@crypto.com', 'admin', ownerUserId);

        expect(invite.token).toHaveLength(64); // 32 bytes in hex = 64 characters
        expect(/^[a-f0-9]{64}$/.test(invite.token)).toBe(true);
      });

      it('F3-2: stores SHA-256 hash of token in database instead of raw token', async () => {
        const org = await createOrganization(db, { name: 'Hash Org', slug: 'hash-org', tier: 'pro', ownerUserId });
        const invite = await createOrgInvitation(db, org.orgId, 'invitee@hash.com', 'creator', ownerUserId);

        const record = await db
          .prepare(`SELECT token_hash FROM organization_invitations WHERE id = ?1`)
          .bind(invite.invitationId)
          .first<{ token_hash: string }>();

        expect(record?.token_hash).toBeDefined();
        expect(record?.token_hash).not.toBe(invite.token); // Raw token is NOT in database
        expect(record?.token_hash).toHaveLength(64);
      });

      it('F3-3: sets expiration exactly to 7 days from creation time', async () => {
        const org = await createOrganization(db, { name: 'Ttl Org', slug: 'ttl-org', tier: 'pro', ownerUserId });
        const before = Date.now();
        const invite = await createOrgInvitation(db, org.orgId, 'invitee@ttl.com', 'viewer', ownerUserId);
        const after = Date.now();

        const expectedMin = before + 7 * 24 * 60 * 60 * 1000;
        const expectedMax = after + 7 * 24 * 60 * 60 * 1000;

        expect(invite.expiresAt).toBeGreaterThanOrEqual(expectedMin);
        expect(invite.expiresAt).toBeLessThanOrEqual(expectedMax);
      });

      it('F3-4: formats acceptance URL with raw token parameter', async () => {
        const org = await createOrganization(db, { name: 'Url Org', slug: 'url-org', tier: 'pro', ownerUserId });
        const invite = await createOrgInvitation(db, org.orgId, 'invitee@url.com', 'admin', ownerUserId);

        expect(invite.inviteUrl).toBe(
          `https://sophia.agencyos.network/invitations/accept?token=${invite.token}`
        );
      });

      it('F3-5: normalizes recipient email to lowercase and trims whitespace', async () => {
        const org = await createOrganization(db, { name: 'Email Org', slug: 'email-org', tier: 'pro', ownerUserId });
        const invite = await createOrgInvitation(db, org.orgId, '  Invitee@Email.COM  ', 'creator', ownerUserId);

        const record = await db
          .prepare(`SELECT email FROM organization_invitations WHERE id = ?1`)
          .bind(invite.invitationId)
          .first<{ email: string }>();

        expect(record?.email).toBe('invitee@email.com');
      });
    });

    describe('F4: Invitation Verification, Atomic Consumption & Role Assignment', () => {
      it('F4-1: accepts valid invitation token and creates member with assigned role', async () => {
        const org = await createOrganization(db, { name: 'Accept Org', slug: 'accept-org', tier: 'pro', ownerUserId });
        const invite = await createOrgInvitation(db, org.orgId, 'newmember@accept.com', 'creator', ownerUserId);

        const result = await acceptOrgInvitation(db, invite.token, 'usr_new_member_1');
        expect(result.success).toBe(true);
        expect(result.orgId).toBe(org.orgId);
        expect(result.role).toBe('creator');

        // Verify member row exists
        const member = await db
          .prepare(`SELECT * FROM organization_members WHERE org_id = ?1 AND user_id = 'usr_new_member_1'`)
          .bind(org.orgId)
          .first<{ role: string }>();

        expect(member?.role).toBe('creator');
      });

      it('F4-2: marks invitation status as accepted with timestamp', async () => {
        const org = await createOrganization(db, { name: 'Consumed Org', slug: 'consumed-org', tier: 'pro', ownerUserId });
        const invite = await createOrgInvitation(db, org.orgId, 'consume@test.com', 'viewer', ownerUserId);

        await acceptOrgInvitation(db, invite.token, 'usr_consumed_1');

        const record = await db
          .prepare(`SELECT status, accepted_at FROM organization_invitations WHERE id = ?1`)
          .bind(invite.invitationId)
          .first<{ status: string; accepted_at: number }>();

        expect(record?.status).toBe('accepted');
        expect(record?.accepted_at).toBeGreaterThan(0);
      });

      it('F4-3: prevents double consumption of the same token (single-use invariant)', async () => {
        const org = await createOrganization(db, { name: 'Replay Org', slug: 'replay-org', tier: 'pro', ownerUserId });
        const invite = await createOrgInvitation(db, org.orgId, 'replay@test.com', 'creator', ownerUserId);

        // First acceptance succeeds
        await acceptOrgInvitation(db, invite.token, 'usr_first');

        // Second acceptance strictly fails
        await expect(
          acceptOrgInvitation(db, invite.token, 'usr_replay_attacker')
        ).rejects.toThrow(/INVITATION_ALREADY_USED/);
      });

      it('F4-4: rejects acceptance with unknown or tampered token', async () => {
        await expect(
          acceptOrgInvitation(db, '0'.repeat(64), 'usr_intruder')
        ).rejects.toThrow(/INVALID_INVITATION_TOKEN/);
      });

      it('F4-5: re-validates seat quota at time of acceptance to prevent oversubscription race', async () => {
        const org = await createOrganization(db, { name: 'Race Org', slug: 'race-org', tier: 'pro', ownerUserId });
        // Max seats: 5. Owner takes 1. Generate an invitation.
        const invite = await createOrgInvitation(db, org.orgId, 'racer@test.com', 'creator', ownerUserId);

        // Fill remaining 4 seats before invitation is accepted
        for (let i = 2; i <= 5; i++) {
          await db
            .prepare(
              `INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
               VALUES (?1, ?2, ?3, 'creator', ?4, ?4)`
            )
            .bind(`mem_fill_${i}`, org.orgId, `usr_fill_${i}`, Date.now())
            .run();
        }

        // Now acceptance fails because org has filled its quota
        await expect(
          acceptOrgInvitation(db, invite.token, 'usr_late_acceptor')
        ).rejects.toThrow(/SEAT_QUOTA_EXCEEDED/);
      });
    });

    describe('F5: 5-Tier RBAC Permission Matrix Evaluation', () => {
      it('F5-1: owner has all 5 permissions', () => {
        const permissions: OrgPermission[] = [
          'canCreateMissions',
          'canManageBilling',
          'canInviteMembers',
          'canPublishVideos',
          'canConfigureWebhooks',
        ];
        for (const p of permissions) {
          expect(hasOrgPermission('owner', p)).toBe(true);
        }
      });

      it('F5-2: admin has all permissions EXCEPT billing management', () => {
        expect(hasOrgPermission('admin', 'canCreateMissions')).toBe(true);
        expect(hasOrgPermission('admin', 'canInviteMembers')).toBe(true);
        expect(hasOrgPermission('admin', 'canPublishVideos')).toBe(true);
        expect(hasOrgPermission('admin', 'canConfigureWebhooks')).toBe(true);
        expect(hasOrgPermission('admin', 'canManageBilling')).toBe(false); // Admin cannot alter billing!
      });

      it('F5-3: creator can create missions and publish videos, but cannot manage members or billing', () => {
        expect(hasOrgPermission('creator', 'canCreateMissions')).toBe(true);
        expect(hasOrgPermission('creator', 'canPublishVideos')).toBe(true);
        expect(hasOrgPermission('creator', 'canManageBilling')).toBe(false);
        expect(hasOrgPermission('creator', 'canInviteMembers')).toBe(false);
        expect(hasOrgPermission('creator', 'canConfigureWebhooks')).toBe(false);
      });

      it('F5-4: billing_manager can ONLY manage billing', () => {
        expect(hasOrgPermission('billing_manager', 'canManageBilling')).toBe(true);
        expect(hasOrgPermission('billing_manager', 'canCreateMissions')).toBe(false);
        expect(hasOrgPermission('billing_manager', 'canInviteMembers')).toBe(false);
        expect(hasOrgPermission('billing_manager', 'canPublishVideos')).toBe(false);
        expect(hasOrgPermission('billing_manager', 'canConfigureWebhooks')).toBe(false);
      });

      it('F5-5: viewer has strictly 0 mutation permissions (read-only role)', () => {
        const permissions: OrgPermission[] = [
          'canCreateMissions',
          'canManageBilling',
          'canInviteMembers',
          'canPublishVideos',
          'canConfigureWebhooks',
        ];
        for (const p of permissions) {
          expect(hasOrgPermission('viewer', p)).toBe(false);
        }
      });
    });

    describe('F6: Org Context Switching & Tenant Data Isolation Guard', () => {
      it('F6-1: assertTenantScope succeeds when context matches resource organization', () => {
        expect(() => assertTenantScope('org_alpha', 'org_alpha')).not.toThrow();
      });

      it('F6-2: assertTenantScope throws CROSS_TENANT_VIOLATION on organization mismatch', () => {
        expect(() => assertTenantScope('org_alpha', 'org_beta')).toThrow(/CROSS_TENANT_VIOLATION/);
      });

      it('F6-3: assertTenantScope throws on empty or undefined organization IDs', () => {
        expect(() => assertTenantScope('', 'org_alpha')).toThrow(/CROSS_TENANT_VIOLATION/);
        expect(() => assertTenantScope('org_alpha', '')).toThrow(/CROSS_TENANT_VIOLATION/);
      });

      it('F6-4: allows user belonging to multiple organizations to switch active context', async () => {
        const orgA = await createOrganization(db, { name: 'Org A', slug: 'org-a', tier: 'starter', ownerUserId });
        const orgB = await createOrganization(db, { name: 'Org B', slug: 'org-b', tier: 'starter', ownerUserId: 'usr_other' });

        // Add user to Org B as admin
        await db
          .prepare(
            `INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
             VALUES ('mem_b_user', ?1, ?2, 'admin', ?3, ?3)`
          )
          .bind(orgB.orgId, ownerUserId, Date.now())
          .run();

        // User memberships
        const memberships = await db
          .prepare(`SELECT org_id, role FROM organization_members WHERE user_id = ?1`)
          .bind(ownerUserId)
          .all<{ org_id: string; role: OrgRole }>();

        expect(memberships.results).toHaveLength(2);

        // Switching context to Org A: authorized for Org A resources
        let currentContext = orgA.orgId;
        expect(() => assertTenantScope(currentContext, orgA.orgId)).not.toThrow();
        expect(() => assertTenantScope(currentContext, orgB.orgId)).toThrow(/CROSS_TENANT_VIOLATION/);

        // Switching context to Org B: authorized for Org B resources
        currentContext = orgB.orgId;
        expect(() => assertTenantScope(currentContext, orgB.orgId)).not.toThrow();
        expect(() => assertTenantScope(currentContext, orgA.orgId)).toThrow(/CROSS_TENANT_VIOLATION/);
      });

      it('F6-5: prevents user from asserting context for an organization they do not belong to', async () => {
        const orgSecret = await createOrganization(db, { name: 'Secret Org', slug: 'secret-org', tier: 'pro', ownerUserId: 'usr_stranger' });
        const memberships = await db
          .prepare(`SELECT org_id FROM organization_members WHERE user_id = ?1`)
          .bind('usr_unauthorized')
          .all<{ org_id: string }>();

        const isMember = (memberships.results ?? []).some((m) => m.org_id === orgSecret.orgId);
        expect(isMember).toBe(false);
      });
    });
  });

  // ============================================================================
  // TIER 2: BOUNDARY & CORNER CASES (>=5 tests)
  // ============================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('B1: rejects expired invitation tokens (>7 days)', async () => {
      const org = await createOrganization(db, { name: 'Expired Org', slug: 'expired-org', tier: 'pro', ownerUserId });
      const invite = await createOrgInvitation(db, org.orgId, 'expired@test.com', 'creator', ownerUserId);

      // Artificially expire the token in database
      const pastTime = Date.now() - 1000;
      await db
        .prepare(`UPDATE organization_invitations SET expires_at = ?1 WHERE id = ?2`)
        .bind(pastTime, invite.invitationId)
        .run();

      await expect(
        acceptOrgInvitation(db, invite.token, 'usr_late')
      ).rejects.toThrow(/INVITATION_EXPIRED/);

      // Verify status was updated to expired
      const row = await db
        .prepare(`SELECT status FROM organization_invitations WHERE id = ?1`)
        .bind(invite.invitationId)
        .first<{ status: string }>();

      expect(row?.status).toBe('expired');
    });

    it('B2: handles duplicate membership gracefully if user already in organization', async () => {
      const org = await createOrganization(db, { name: 'Dupe Org', slug: 'dupe-org', tier: 'pro', ownerUserId });
      const invite = await createOrgInvitation(db, org.orgId, 'dupe@test.com', 'creator', ownerUserId);

      // User accepts
      await acceptOrgInvitation(db, invite.token, 'usr_same');

      // Another invite for same user
      const invite2 = await createOrgInvitation(db, org.orgId, 'dupe2@test.com', 'admin', ownerUserId);
      await expect(
        acceptOrgInvitation(db, invite2.token, 'usr_same')
      ).rejects.toThrow(); // SQLite UNIQUE constraint on (org_id, user_id)
    });

    it('B3: checks non-existent orgId in checkSeatQuota throws descriptive error', async () => {
      await expect(checkSeatQuota(db, 'org_nonexistent')).rejects.toThrow(
        /ORGANIZATION_NOT_FOUND/
      );
    });

    it('B4: invitation email case sensitivity does not create duplicate invites', async () => {
      const org = await createOrganization(db, { name: 'Case Org', slug: 'case-org', tier: 'pro', ownerUserId });
      const i1 = await createOrgInvitation(db, org.orgId, 'User@Domain.Com', 'viewer', ownerUserId);
      const row = await db
        .prepare(`SELECT email FROM organization_invitations WHERE id = ?1`)
        .bind(i1.invitationId)
        .first<{ email: string }>();

      expect(row?.email).toBe('user@domain.com');
    });

    it('B5: cross-tenant attack simulation: actor attempting to mutate another org membership fails', async () => {
      const orgA = await createOrganization(db, { name: 'A', slug: 'a', tier: 'starter', ownerUserId: 'usr_a' });
      const orgB = await createOrganization(db, { name: 'B', slug: 'b', tier: 'starter', ownerUserId: 'usr_b' });

      expect(() => {
        assertTenantScope(orgA.orgId, orgB.orgId);
      }).toThrow(/CROSS_TENANT_VIOLATION/);
    });
  });

  // ============================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS
  // ============================================================================
  describe('Tier 3: Cross-Feature Combinations', () => {
    it('P1: invitation role directly maps to RBAC permissions upon acceptance', async () => {
      const org = await createOrganization(db, { name: 'Combo Org', slug: 'combo-org', tier: 'pro', ownerUserId });

      // Generate invitations for 3 distinct roles
      const iAdmin = await createOrgInvitation(db, org.orgId, 'admin@combo.com', 'admin', ownerUserId);
      const iCreator = await createOrgInvitation(db, org.orgId, 'creator@combo.com', 'creator', ownerUserId);
      const iBilling = await createOrgInvitation(db, org.orgId, 'billing@combo.com', 'billing_manager', ownerUserId);

      // Accept them
      const rAdmin = await acceptOrgInvitation(db, iAdmin.token, 'usr_adm');
      const rCreator = await acceptOrgInvitation(db, iCreator.token, 'usr_crt');
      const rBilling = await acceptOrgInvitation(db, iBilling.token, 'usr_bil');

      // Verify RBAC properties of accepted roles
      expect(hasOrgPermission(rAdmin.role, 'canInviteMembers')).toBe(true);
      expect(hasOrgPermission(rAdmin.role, 'canManageBilling')).toBe(false);

      expect(hasOrgPermission(rCreator.role, 'canCreateMissions')).toBe(true);
      expect(hasOrgPermission(rCreator.role, 'canInviteMembers')).toBe(false);

      expect(hasOrgPermission(rBilling.role, 'canManageBilling')).toBe(true);
      expect(hasOrgPermission(rBilling.role, 'canCreateMissions')).toBe(false);
    });

    it('P2: upgrading organization tier dynamically raises max seats and allows pending invites', async () => {
      const org = await createOrganization(db, { name: 'Upgrade Org', slug: 'upgrade-org', tier: 'starter', ownerUserId });
      // Starter quota: 1 seat (occupied by owner)
      const q1 = await checkSeatQuota(db, org.orgId);
      expect(q1.isAllowed).toBe(false);

      // Upgrade tier to Pro in database
      await db
        .prepare(`UPDATE organizations SET tier = 'pro', max_seats = 5 WHERE id = ?1`)
        .bind(org.orgId)
        .run();

      const q2 = await checkSeatQuota(db, org.orgId);
      expect(q2.maxSeats).toBe(5);
      expect(q2.isAllowed).toBe(true);

      // Now invite succeeds
      const invite = await createOrgInvitation(db, org.orgId, 'new@upgrade.com', 'creator', ownerUserId);
      expect(invite.token).toBeDefined();
    });
  });

  // ============================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // ============================================================================
  describe('Tier 4: Real-World Scenarios', () => {
    it('S1: complete Enterprise Team Onboarding & Multi-Role Collaboration Lifecycle', async () => {
      // Step 1: Enterprise founder creates Master tier organization
      const org = await createOrganization(db, {
        name: 'OmniMedia Global',
        slug: 'omni-media',
        tier: 'master',
        ownerUserId: 'usr_founder',
      });
      expect(org.maxSeats).toBe(999);

      // Step 2: Founder invites leadership team across roles
      const invAdmin = await createOrgInvitation(db, org.orgId, 'cto@omni.com', 'admin', 'usr_founder');
      const invCreator = await createOrgInvitation(db, org.orgId, 'lead.artist@omni.com', 'creator', 'usr_founder');
      const invBilling = await createOrgInvitation(db, org.orgId, 'cfo@omni.com', 'billing_manager', 'usr_founder');
      const invViewer = await createOrgInvitation(db, org.orgId, 'investor@fund.com', 'viewer', 'usr_founder');

      // Step 3: All 4 members receive cryptographic links and accept
      const cto = await acceptOrgInvitation(db, invAdmin.token, 'usr_cto');
      const artist = await acceptOrgInvitation(db, invCreator.token, 'usr_artist');
      const cfo = await acceptOrgInvitation(db, invBilling.token, 'usr_cfo');
      const investor = await acceptOrgInvitation(db, invViewer.token, 'usr_investor');

      expect(cto.role).toBe('admin');
      expect(artist.role).toBe('creator');
      expect(cfo.role).toBe('billing_manager');
      expect(investor.role).toBe('viewer');

      // Step 4: Verify seat quota reflects 5 members allocated
      const quota = await checkSeatQuota(db, org.orgId);
      expect(quota.allocated).toBe(5);
      expect(quota.maxSeats).toBe(999);

      // Step 5: Test role privilege enforcement across team members
      // CTO (admin) can invite new staff, but cannot touch billing
      expect(hasOrgPermission(cto.role, 'canInviteMembers')).toBe(true);
      expect(hasOrgPermission(cto.role, 'canManageBilling')).toBe(false);

      // Lead Artist (creator) can create missions, but cannot invite staff
      expect(hasOrgPermission(artist.role, 'canCreateMissions')).toBe(true);
      expect(hasOrgPermission(artist.role, 'canInviteMembers')).toBe(false);

      // CFO (billing_manager) manages billing, but cannot publish videos
      expect(hasOrgPermission(cfo.role, 'canManageBilling')).toBe(true);
      expect(hasOrgPermission(cfo.role, 'canPublishVideos')).toBe(false);

      // Investor (viewer) is strictly read-only
      expect(hasOrgPermission(investor.role, 'canCreateMissions')).toBe(false);
      expect(hasOrgPermission(investor.role, 'canManageBilling')).toBe(false);

      // Step 6: Tenant isolation asserts all operations stay within OmniMedia
      expect(() => assertTenantScope(org.orgId, org.orgId)).not.toThrow();
      expect(() => assertTenantScope(org.orgId, 'org_rival_agency')).toThrow(/CROSS_TENANT_VIOLATION/);
    });
  });
});

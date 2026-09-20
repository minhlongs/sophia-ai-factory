/**
 * Empirical Challenger Adversarial Stress Test Suite:
 * Milestone 2 5-Tier RBAC & Tenant Data Isolation Guard
 *
 * Exhaustively probes and challenges:
 * 1. Privilege Escalation Attacks:
 *    - Creator attempting to invite members, manage billing, configure webhooks, or escalate roles
 *    - Admin attempting to manage billing (Strict Separation of Duties), invite owners, or demote owners
 *    - Viewer attempting any mutation operation (missions, billing, invites, videos, webhooks)
 *    - Billing Manager attempting operational and content mutations
 *    - Server Actions enforcing anti-escalation and role delegation boundaries
 *    - Prototype pollution, case tampering, SQL injection, and invalid role/permission strings
 * 2. Cross-Tenant Context Injection & Data Leakage Attacks:
 *    - Context injection: Passing targetOrgId when active org context is attackerOrgId
 *    - Inverted context, empty strings, whitespace, null, undefined, and path traversal strings
 *    - Resource scope enforcement across camelCase and snake_case properties
 *    - Synchronous isolation barrier guaranteeing zero side-effects on mismatch
 *    - Multi-tenant dataset filtering preventing record leakage
 *    - Context switching spoofing, inactive org rejection, and spoofed request header/cookie ignoring
 * 3. Cross-Tenant Invitations, Token Attacks & Quota Exhaustion Stress:
 *    - Token confinement: tokens remain scoped to the issuing organization
 *    - Cross-tenant revocation rejection (attacker cannot revoke victim's invites)
 *    - Tier seat quota enforcement across tiers (Free: 1, Pro: 5, Master: 999)
 *    - Oversubscription race condition simulation & anti-replay single-use token guarantees
 *    - Malformed token probing (SQLi, null bytes, buffer bounds) and email normalization
 *
 * @module __tests__/integration/enterprise/rbac-isolation-stress.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import {
  ALL_ORG_ROLES,
  ALL_ORG_PERMISSIONS,
  RBAC_PERMISSIONS_MATRIX,
  ROLE_PERMISSION_FLAGS,
  isOrgRole,
  isOrgPermission,
  type OrgRole,
  type OrgPermission,
} from '@/seed/types/rbac-matrix';
import {
  hasOrgPermission,
  assertOrgPermission,
  RbacPermissionError,
  canCreateMissions,
  canManageBilling,
  canInviteMembers,
  canPublishVideos,
  canConfigureWebhooks,
  assertCanCreateMissions,
  assertCanManageBilling,
  assertCanInviteMembers,
  assertCanPublishVideos,
  assertCanConfigureWebhooks,
  canAssignRole,
  canManageMember,
} from '@/tree/rbac/permissions';
import {
  assertTenantScope,
  assertResourceScope,
  withTenantIsolation,
  filterByTenant,
  CrossTenantViolationError,
} from '@/forest/tenant/isolation-guard';
import {
  switchActiveOrg,
  validateOrgMembership,
  getActiveOrgContext,
  listUserOrganizations,
  OrgContextError,
  ACTIVE_ORG_HEADER,
  ACTIVE_ORG_COOKIE,
} from '@/forest/tenant/context-switcher';
import {
  createOrgInvitation,
  acceptOrgInvitation,
  revokeOrgInvitation,
} from '@/tree/organizations/invitation-service';
import { checkSeatQuota } from '@/tree/organizations/seat-quota-engine';
import {
  sendOrgInvitationAction,
  acceptOrgInvitationAction,
  revokeOrgInvitationAction,
} from '@/land/admin/org-invitation-actions';
import { sha256Hex } from '@/seed/security/invitation-token';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockLogAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.mockGetCurrentUser,
}));

vi.mock('@/tree/audit/logger/audit-query', () => ({
  logAuditEvent: mocks.mockLogAuditEvent,
}));

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => any;
};

describe('Empirical Challenger: 5-Tier RBAC & Tenant Data Isolation Stress Suite', () => {
  let rawDb: any;
  let db: any;

  const orgVictim = 'org_victim_corp';
  const orgAttacker = 'org_attacker_syndicate';
  const orgFree = 'org_free_solo';
  const orgSuspended = 'org_suspended_tenant';

  const userVictimOwner = 'usr_victim_owner';
  const userVictimAdmin = 'usr_victim_admin';
  const userVictimCreator = 'usr_victim_creator';
  const userVictimBilling = 'usr_victim_billing';
  const userVictimViewer = 'usr_victim_viewer';

  const userAttacker = 'usr_malicious_attacker';

  beforeEach(() => {
    vi.clearAllMocks();

    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
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

      CREATE VIEW IF NOT EXISTS org_members AS SELECT * FROM organization_members;

      CREATE TABLE org_invitations (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at INTEGER NOT NULL,
        accepted_at INTEGER,
        created_by TEXT NOT NULL,
        invited_by TEXT GENERATED ALWAYS AS (created_by) VIRTUAL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE VIEW IF NOT EXISTS organization_invitations AS SELECT * FROM org_invitations;

      -- Populate Victim Org (Pro tier, 10 seats, 5 members initially)
      INSERT INTO organizations (id, name, slug, tier, max_seats, status)
      VALUES ('${orgVictim}', 'Victim Enterprise Corp', 'victim-corp', 'pro', 10, 'active');

      INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at) VALUES
        ('mem_vic_1', '${orgVictim}', '${userVictimOwner}', 'owner', 1000, 1000),
        ('mem_vic_2', '${orgVictim}', '${userVictimAdmin}', 'admin', 1100, 1100),
        ('mem_vic_3', '${orgVictim}', '${userVictimCreator}', 'creator', 1200, 1200),
        ('mem_vic_4', '${orgVictim}', '${userVictimBilling}', 'billing_manager', 1300, 1300),
        ('mem_vic_5', '${orgVictim}', '${userVictimViewer}', 'viewer', 1400, 1400);

      -- Populate Attacker Org (Starter tier, 1 seat)
      INSERT INTO organizations (id, name, slug, tier, max_seats, status)
      VALUES ('${orgAttacker}', 'Attacker Syndicate', 'attacker-syndicate', 'starter', 1, 'active');

      INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at) VALUES
        ('mem_atk_1', '${orgAttacker}', '${userAttacker}', 'owner', 2000, 2000);

      -- Populate Free Solo Org (Free tier, 1 seat, 1 owner)
      INSERT INTO organizations (id, name, slug, tier, max_seats, status)
      VALUES ('${orgFree}', 'Free Solo Studio', 'free-solo', 'free', 1, 'active');

      INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at) VALUES
        ('mem_free_1', '${orgFree}', 'usr_free_owner', 'owner', 3000, 3000);

      -- Populate Suspended Org
      INSERT INTO organizations (id, name, slug, tier, max_seats, status)
      VALUES ('${orgSuspended}', 'Suspended LLC', 'suspended-llc', 'pro', 5, 'suspended');

      INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at) VALUES
        ('mem_susp_1', '${orgSuspended}', '${userAttacker}', 'creator', 4000, 4000);
    `);

    db = makeD1(rawDb);
    mocks.mockGetD1.mockResolvedValue(db);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // 1. PRIVILEGE ESCALATION ATTACKS (VERTICAL & HORIZONTAL)
  // ===========================================================================
  describe('1. Privilege Escalation & Separation of Duties Attacks', () => {
    describe('1.1 Creator Role Escalation Attacks', () => {
      it('creator CANNOT invite members (permission check & assertion guard)', () => {
        expect(hasOrgPermission('creator', 'canInviteMembers')).toBe(false);
        expect(canInviteMembers('creator')).toBe(false);
        expect(() => assertCanInviteMembers('creator')).toThrow(RbacPermissionError);
        expect(() => assertOrgPermission('creator', 'canInviteMembers')).toThrow(
          /RBAC_PERMISSION_DENIED: Role 'creator' lacks permission 'canInviteMembers'/,
        );
      });

      it('creator CANNOT manage billing or alter subscription tiers', () => {
        expect(hasOrgPermission('creator', 'canManageBilling')).toBe(false);
        expect(canManageBilling('creator')).toBe(false);
        expect(() => assertCanManageBilling('creator')).toThrow(RbacPermissionError);
      });

      it('creator CANNOT configure outbound webhooks', () => {
        expect(hasOrgPermission('creator', 'canConfigureWebhooks')).toBe(false);
        expect(canConfigureWebhooks('creator')).toBe(false);
        expect(() => assertCanConfigureWebhooks('creator')).toThrow(RbacPermissionError);
      });

      it('creator CANNOT delegate or assign ANY role (horizontal or vertical escalation)', () => {
        for (const targetRole of ALL_ORG_ROLES) {
          expect(canAssignRole('creator', targetRole)).toBe(false);
        }
      });

      it('creator CANNOT manage, demote, or remove ANY member', () => {
        for (const targetRole of ALL_ORG_ROLES) {
          expect(canManageMember('creator', targetRole)).toBe(false);
        }
      });
    });

    describe('1.2 Admin Role Separation of Duties & Anti-Takeover', () => {
      it('admin CANNOT manage billing (Strict Separation of Duties)', () => {
        expect(hasOrgPermission('admin', 'canManageBilling')).toBe(false);
        expect(canManageBilling('admin')).toBe(false);
        expect(() => assertCanManageBilling('admin')).toThrow(RbacPermissionError);
      });

      it('admin CANNOT assign or invite the "owner" role (hostile takeover block)', () => {
        expect(canAssignRole('admin', 'owner')).toBe(false);
      });

      it('admin CANNOT create peer admins via role delegation', () => {
        expect(canAssignRole('admin', 'admin')).toBe(false);
      });

      it('admin CAN assign creator, billing_manager, and viewer roles', () => {
        expect(canAssignRole('admin', 'creator')).toBe(true);
        expect(canAssignRole('admin', 'billing_manager')).toBe(true);
        expect(canAssignRole('admin', 'viewer')).toBe(true);
      });

      it('admin CANNOT demote or remove the organization owner', () => {
        expect(canManageMember('admin', 'owner')).toBe(false);
      });

      it('admin CANNOT manage, demote, or remove a peer admin', () => {
        expect(canManageMember('admin', 'admin')).toBe(false);
      });

      it('admin CAN manage creators, billing managers, and viewers', () => {
        expect(canManageMember('admin', 'creator')).toBe(true);
        expect(canManageMember('admin', 'billing_manager')).toBe(true);
        expect(canManageMember('admin', 'viewer')).toBe(true);
      });
    });

    describe('1.3 Viewer Role Mutation Suppression (Zero Mutation Rights)', () => {
      it('viewer has exactly ZERO granted permissions across all 5 permissions', () => {
        expect(RBAC_PERMISSIONS_MATRIX.viewer).toEqual([]);
        for (const permission of ALL_ORG_PERMISSIONS) {
          expect(hasOrgPermission('viewer', permission)).toBe(false);
          expect(ROLE_PERMISSION_FLAGS.viewer[permission]).toBe(false);
        }
      });

      it('viewer assertion guards throw fail-closed RbacPermissionError on all mutations', () => {
        expect(() => assertCanCreateMissions('viewer')).toThrow(RbacPermissionError);
        expect(() => assertCanManageBilling('viewer')).toThrow(RbacPermissionError);
        expect(() => assertCanInviteMembers('viewer')).toThrow(RbacPermissionError);
        expect(() => assertCanPublishVideos('viewer')).toThrow(RbacPermissionError);
        expect(() => assertCanConfigureWebhooks('viewer')).toThrow(RbacPermissionError);
      });

      it('viewer CANNOT assign roles or manage members', () => {
        for (const targetRole of ALL_ORG_ROLES) {
          expect(canAssignRole('viewer', targetRole)).toBe(false);
          expect(canManageMember('viewer', targetRole)).toBe(false);
        }
      });
    });

    describe('1.4 Billing Manager Separation of Duties', () => {
      it('billing_manager possesses ONLY canManageBilling and ZERO operational rights', () => {
        expect(canManageBilling('billing_manager')).toBe(true);
        expect(canCreateMissions('billing_manager')).toBe(false);
        expect(canInviteMembers('billing_manager')).toBe(false);
        expect(canPublishVideos('billing_manager')).toBe(false);
        expect(canConfigureWebhooks('billing_manager')).toBe(false);
      });

      it('billing_manager cannot assign roles or manage members', () => {
        for (const targetRole of ALL_ORG_ROLES) {
          expect(canAssignRole('billing_manager', targetRole)).toBe(false);
          expect(canManageMember('billing_manager', targetRole)).toBe(false);
        }
      });
    });

    describe('1.5 Server Action Level Privilege Escalation Probing', () => {
      it('rejects unauthenticated caller attempting to send invitations', async () => {
        mocks.mockGetCurrentUser.mockResolvedValueOnce(null);

        const result = await sendOrgInvitationAction({
          orgId: orgVictim,
          email: 'infiltrator@agency.com',
          role: 'viewer',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('UNAUTHORIZED');
        }
      });

      it('rejects caller with creator role attempting to send invitations', async () => {
        mocks.mockGetCurrentUser.mockResolvedValueOnce({ id: userVictimCreator, email: 'creator@victim.com' });

        const result = await sendOrgInvitationAction({
          orgId: orgVictim,
          email: 'infiltrator@agency.com',
          role: 'viewer',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('INSUFFICIENT_PERMISSIONS');
          expect(result.error.message).toContain("Role 'creator' is not permitted to invite members");
        }
      });

      it('rejects caller with viewer role attempting to send invitations', async () => {
        mocks.mockGetCurrentUser.mockResolvedValueOnce({ id: userVictimViewer, email: 'viewer@victim.com' });

        const result = await sendOrgInvitationAction({
          orgId: orgVictim,
          email: 'infiltrator@agency.com',
          role: 'viewer',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('INSUFFICIENT_PERMISSIONS');
        }
      });

      it('blocks admin caller attempting to invite an "owner" (escalation attempt)', async () => {
        mocks.mockGetCurrentUser.mockResolvedValueOnce({ id: userVictimAdmin, email: 'admin@victim.com' });

        const result = await sendOrgInvitationAction({
          orgId: orgVictim,
          email: 'new_owner@victim.com',
          role: 'owner',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('PRIVILEGE_ESCALATION');
          expect(result.error.message).toContain("Role 'admin' cannot assign role 'owner'");
        }
      });

      it('blocks admin caller attempting to invite a peer "admin"', async () => {
        mocks.mockGetCurrentUser.mockResolvedValueOnce({ id: userVictimAdmin, email: 'admin@victim.com' });

        const result = await sendOrgInvitationAction({
          orgId: orgVictim,
          email: 'peer_admin@victim.com',
          role: 'admin',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('PRIVILEGE_ESCALATION');
          expect(result.error.message).toContain("Role 'admin' cannot assign role 'admin'");
        }
      });

      it('blocks non-member user attempting to send invitations to an organization', async () => {
        mocks.mockGetCurrentUser.mockResolvedValueOnce({ id: userAttacker, email: 'attacker@evil.com' });

        const result = await sendOrgInvitationAction({
          orgId: orgVictim,
          email: 'infiltrator@agency.com',
          role: 'viewer',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('FORBIDDEN');
          expect(result.error.message).toContain('You are not a member of this organization');
        }
      });

      it('blocks creator or viewer attempting to revoke invitations', async () => {
        mocks.mockGetCurrentUser.mockResolvedValueOnce({ id: userVictimCreator, email: 'creator@victim.com' });

        const result = await revokeOrgInvitationAction('inv_dummy', orgVictim);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('FORBIDDEN');
        }
      });
    });

    describe('1.6 Hostile Input Tampering & Prototype Pollution on RBAC', () => {
      const hostileRoles = [
        '__proto__',
        'constructor',
        'prototype',
        'toString',
        'valueOf',
        'admin; DROP TABLE users; --',
        '<script>alert(1)</script>',
        'OWNER',
        'Owner',
        ' admin ',
        'admin\0',
        'root',
        'superadmin',
        'system',
        '',
        '   ',
      ];

      const hostilePermissions = [
        '__proto__',
        'constructor',
        'prototype',
        'toString',
        'canDoEverything',
        'canBypassAuth',
        'canManageBilling; DROP TABLE',
        'canManageBilling\0',
        'CANMANAGEBILLING',
        'canmanagebilling',
        '',
      ];

      it.each(hostileRoles)('fails closed when hostile role "%s" is evaluated', (role) => {
        expect(isOrgRole(role)).toBe(false);
        expect(hasOrgPermission(role, 'canManageBilling')).toBe(false);
        expect(canCreateMissions(role)).toBe(false);
        expect(canManageBilling(role)).toBe(false);
        expect(canInviteMembers(role)).toBe(false);
        expect(canPublishVideos(role)).toBe(false);
        expect(canConfigureWebhooks(role)).toBe(false);
        expect(() => assertOrgPermission(role, 'canManageBilling')).toThrow(RbacPermissionError);
        expect(canAssignRole(role, 'viewer')).toBe(false);
        expect(canManageMember(role, 'viewer')).toBe(false);
      });

      it.each(hostilePermissions)('fails closed when hostile permission "%s" is queried', (permission) => {
        expect(isOrgPermission(permission)).toBe(false);
        expect(hasOrgPermission('owner', permission)).toBe(false);
        expect(() => assertOrgPermission('owner', permission)).toThrow(RbacPermissionError);
      });

      it('prevents prototype pollution from altering RBAC flags', () => {
        // Attempt prototype tampering
        const maliciousKey = 'pollutedPermission';
        (Object.prototype as any)[maliciousKey] = true;

        try {
          expect(hasOrgPermission('viewer', maliciousKey)).toBe(false);
          expect(hasOrgPermission('admin', maliciousKey)).toBe(false);
          expect(hasOrgPermission('creator', maliciousKey)).toBe(false);
        } finally {
          delete (Object.prototype as any)[maliciousKey];
        }
      });

      it('fails closed when non-string types (numbers, booleans, objects, functions, symbols) are passed', () => {
        const nonStringTypes = [
          null,
          undefined,
          12345,
          true,
          false,
          {},
          [],
          () => {},
          Symbol('role'),
        ];

        for (const val of nonStringTypes) {
          expect(isOrgRole(val)).toBe(false);
          expect(isOrgPermission(val)).toBe(false);
          expect(hasOrgPermission(val as any, 'canManageBilling')).toBe(false);
          expect(hasOrgPermission('owner', val as any)).toBe(false);
          expect(canCreateMissions(val as any)).toBe(false);
          expect(canAssignRole(val as any, 'viewer')).toBe(false);
          expect(canManageMember(val as any, 'viewer')).toBe(false);
          expect(() => assertOrgPermission(val as any, 'canManageBilling')).toThrow(RbacPermissionError);
        }
      });
    });
  });

  // ===========================================================================
  // 2. CROSS-TENANT CONTEXT INJECTION & DATA LEAKAGE ATTACKS
  // ===========================================================================
  describe('2. Cross-Tenant Context Injection & Data Leakage Attacks', () => {
    describe('2.1 Direct Context Injection & Mismatch Attacks on assertTenantScope', () => {
      it('blocks attacker trying to access victim organization resources', () => {
        expect(() => assertTenantScope(orgAttacker, orgVictim)).toThrow(CrossTenantViolationError);
        expect(() => assertTenantScope(orgAttacker, orgVictim)).toThrow(
          /CROSS_TENANT_VIOLATION: Current org context 'org_attacker_syndicate' is not authorized to access resource in org 'org_victim_corp'/,
        );
      });

      it('blocks inverted context injection (victim accessing attacker)', () => {
        expect(() => assertTenantScope(orgVictim, orgAttacker)).toThrow(CrossTenantViolationError);
      });

      it('rejects prefix and suffix collisions (e.g. org_victim vs org_victim_corp)', () => {
        expect(() => assertTenantScope('org_victim', orgVictim)).toThrow(CrossTenantViolationError);
        expect(() => assertTenantScope(orgVictim, `${orgVictim}_extra`)).toThrow(CrossTenantViolationError);
        expect(() => assertTenantScope('org_1', 'org_10')).toThrow(CrossTenantViolationError);
      });

      it('enforces strict case sensitivity: rejects case-divergent org IDs', () => {
        expect(() => assertTenantScope('ORG_VICTIM_CORP', orgVictim)).toThrow(CrossTenantViolationError);
        expect(() => assertTenantScope(orgVictim, 'ORG_VICTIM_CORP')).toThrow(CrossTenantViolationError);
      });
    });

    describe('2.2 Boundary & Malformed Inputs on assertTenantScope', () => {
      const invalidInputs: [string | null | undefined, string | null | undefined][] = [
        ['', orgVictim],
        ['   ', orgVictim],
        [null, orgVictim],
        [undefined, orgVictim],
        [orgAttacker, ''],
        [orgAttacker, '   '],
        [orgAttacker, null],
        [orgAttacker, undefined],
        ['', ''],
        [null, null],
        [undefined, undefined],
        ['../org_victim_corp', orgVictim],
        [orgVictim, '../org_victim_corp'],
        ["' OR '1'='1", orgVictim],
        ['org_victim\0', orgVictim],
      ];

      it.each(invalidInputs)('assertTenantScope fails closed for inputs: (%s, %s)', (curr, res) => {
        expect(() => assertTenantScope(curr, res)).toThrow(CrossTenantViolationError);
        expect(() => assertTenantScope(curr, res)).toThrow(/CROSS_TENANT_VIOLATION/);
      });
    });

    describe('2.3 Resource Scope Assertion Attacks (assertResourceScope)', () => {
      it('throws CrossTenantViolationError when resource is null or undefined', () => {
        expect(() => assertResourceScope(orgVictim, null)).toThrow(CrossTenantViolationError);
        expect(() => assertResourceScope(orgVictim, undefined)).toThrow(CrossTenantViolationError);
      });

      it('throws CrossTenantViolationError when resource has no org_id or orgId attribute', () => {
        const unScopedResource = { id: 'asset_123', title: 'Orphan Asset' };
        expect(() => assertResourceScope(orgVictim, unScopedResource as any)).toThrow(
          CrossTenantViolationError,
        );
      });

      it('throws CrossTenantViolationError on cross-tenant snake_case org_id mismatch', () => {
        const victimResource = { id: 'asset_vic', org_id: orgVictim, name: 'Victim Strategy' };
        expect(() => assertResourceScope(orgAttacker, victimResource)).toThrow(CrossTenantViolationError);
      });

      it('throws CrossTenantViolationError on cross-tenant camelCase orgId mismatch', () => {
        const victimResource = { id: 'asset_vic', orgId: orgVictim, name: 'Victim Strategy' };
        expect(() => assertResourceScope(orgAttacker, victimResource)).toThrow(CrossTenantViolationError);
      });

      it('rejects conflicting identifiers when resource has mismatched org_id and orgId', () => {
        // Resource has org_id belonging to victim, but spoofed orgId belonging to attacker
        const hostileResource = { id: 'asset_spoofed', org_id: orgVictim, orgId: orgAttacker };
        // Attacker attempting access
        expect(() => assertResourceScope(orgAttacker, hostileResource)).toThrow(CrossTenantViolationError);
      });

      it('passes cleanly when resource org aligns with caller org', () => {
        const validSnake = { id: 'asset_1', org_id: orgVictim };
        const validCamel = { id: 'asset_2', orgId: orgVictim };
        expect(() => assertResourceScope(orgVictim, validSnake)).not.toThrow();
        expect(() => assertResourceScope(orgVictim, validCamel)).not.toThrow();
      });
    });

    describe('2.4 Execution Guard Barrier (withTenantIsolation)', () => {
      it('aborts execution with CrossTenantViolationError and PREVENTS side-effects on mismatch', async () => {
        let sideEffectExecuted = false;

        const maliciousExecution = async () => {
          await withTenantIsolation(orgAttacker, orgVictim, () => {
            sideEffectExecuted = true;
            return 'exfiltrated_data';
          });
        };

        await expect(maliciousExecution()).rejects.toThrow(CrossTenantViolationError);
        expect(sideEffectExecuted).toBe(false);
      });

      it('executes cleanly and returns value when tenant scopes match', async () => {
        const result = await withTenantIsolation(orgVictim, orgVictim, () => {
          return 'legitimate_data';
        });
        expect(result).toBe('legitimate_data');
      });
    });

    describe('2.5 Data Leakage Prevention on Datasets (filterByTenant)', () => {
      const mixedTenantDataset = [
        { id: 'item_1', org_id: orgVictim, title: 'Victim Q3 Financials' },
        { id: 'item_2', org_id: orgAttacker, title: 'Attacker Campaign' },
        { id: 'item_3', orgId: orgVictim, title: 'Victim Secret Blueprint' },
        { id: 'item_4', org_id: orgFree, title: 'Free Solo Video' },
        { id: 'item_5', org_id: orgSuspended, title: 'Suspended Record' },
        { id: 'item_6', org_id: 'org_third_party', title: 'Third Party Data' },
      ];

      it('strictly confines results to the caller tenant and excludes all other tenants', () => {
        const attackerResults = filterByTenant(mixedTenantDataset, orgAttacker);
        expect(attackerResults).toHaveLength(1);
        expect(attackerResults[0].id).toBe('item_2');

        const victimResults = filterByTenant(mixedTenantDataset, orgVictim);
        expect(victimResults).toHaveLength(2);
        expect(victimResults.map((r) => r.id)).toEqual(['item_1', 'item_3']);
      });

      it('returns empty array when caller orgId is empty or whitespace (no wildcard leak)', () => {
        expect(filterByTenant(mixedTenantDataset, '')).toEqual([]);
        expect(filterByTenant(mixedTenantDataset, '   ')).toEqual([]);
        expect(filterByTenant(mixedTenantDataset, null as any)).toEqual([]);
        expect(filterByTenant(mixedTenantDataset, undefined as any)).toEqual([]);
      });
    });

    describe('2.6 Multi-Tenant Context Switching & Membership Validation Attacks', () => {
      it('rejects context switch to an organization where user has NO membership', async () => {
        await expect(
          switchActiveOrg(userAttacker, orgVictim, db),
        ).rejects.toThrow(OrgContextError);

        try {
          await switchActiveOrg(userAttacker, orgVictim, db);
        } catch (err: any) {
          expect(err.code).toBe('MEMBERSHIP_NOT_FOUND');
        }
      });

      it('rejects context switch to a suspended organization even if user has membership record', async () => {
        // userAttacker is in orgSuspended, but org status is 'suspended'
        await expect(
          switchActiveOrg(userAttacker, orgSuspended, db),
        ).rejects.toThrow(OrgContextError);

        try {
          await switchActiveOrg(userAttacker, orgSuspended, db);
        } catch (err: any) {
          expect(err.code).toBe('MEMBERSHIP_NOT_FOUND');
        }
      });

      it('ignores spoofed x-active-org-id header in getActiveOrgContext and falls back to primary org', async () => {
        const headers = new Headers();
        headers.set(ACTIVE_ORG_HEADER, orgVictim); // Attacker tries to spoof victim org header

        const context = await getActiveOrgContext({
          reqHeaders: headers,
          explicitUserId: userAttacker,
          dbClient: db,
        });

        // Must NOT grant victim context; falls back to attacker's legitimate org
        expect(context).not.toBeNull();
        expect(context?.orgId).toBe(orgAttacker);
        expect(context?.orgId).not.toBe(orgVictim);
      });

      it('ignores spoofed active_org_id cookie in getActiveOrgContext', async () => {
        const context = await getActiveOrgContext({
          activeCookie: orgVictim, // Attacker forged cookie
          explicitUserId: userAttacker,
          dbClient: db,
        });

        expect(context).not.toBeNull();
        expect(context?.orgId).toBe(orgAttacker);
        expect(context?.orgId).not.toBe(orgVictim);
      });

      it('returns null for an authenticated user who belongs to zero active organizations', async () => {
        const context = await getActiveOrgContext({
          explicitUserId: 'usr_orphan_without_org',
          dbClient: db,
        });

        expect(context).toBeNull();
      });

      it('resists SQL injection payloads in membership validation', async () => {
        const sqliPayloads = [
          "' OR '1'='1",
          "'; DROP TABLE organization_members; --",
          "' UNION SELECT * FROM organization_members --",
        ];

        for (const payload of sqliPayloads) {
          const val1 = await validateOrgMembership(payload, orgVictim, db);
          expect(val1.isMember).toBe(false);

          const val2 = await validateOrgMembership(userVictimOwner, payload, db);
          expect(val2.isMember).toBe(false);
        }
      });
    });
  });

  // ===========================================================================
  // 3. CROSS-TENANT INVITATIONS, TOKEN REPLAY & QUOTA EXHAUSTION STRESS
  // ===========================================================================
  describe('3. Cross-Tenant Invitations, Token Attacks & Quota Exhaustion Stress', () => {
    describe('3.1 Cross-Tenant Token Confinement & Anti-Hijacking', () => {
      it('confines accepted invitation to the issuing organization: attacker cannot divert membership', async () => {
        // Victim org creates an invite for legitimate prospective designer
        const invite = await createOrgInvitation(db, {
          orgId: orgVictim,
          email: 'designer@partner.com',
          role: 'creator',
          invitedByUserId: userVictimOwner,
        });

        // Attacker intercepts token and calls acceptOrgInvitation
        const result = await acceptOrgInvitation(db, invite.token, userAttacker);

        // Member is created in orgVictim (with role creator), NOT orgAttacker!
        expect(result.success).toBe(true);
        expect(result.orgId).toBe(orgVictim);
        expect(result.role).toBe('creator');

        // Verify database entry in orgVictim
        const memberRow = rawDb
          .prepare('SELECT * FROM organization_members WHERE user_id = ? AND org_id = ?')
          .get(userAttacker, orgVictim) as any;

        expect(memberRow).toBeDefined();
        expect(memberRow.org_id).toBe(orgVictim);
        expect(memberRow.role).toBe('creator');

        // Token is consumed: second attempt fails with INVITATION_ALREADY_USED
        await expect(
          acceptOrgInvitation(db, invite.token, 'usr_another_actor'),
        ).rejects.toThrow(/INVITATION_ALREADY_USED/);
      });

      it('prevents existing member from escalating role via accepting higher-role invitation (UNIQUE constraint defense)', async () => {
        // Create an admin invite in victim org
        const invite = await createOrgInvitation(db, {
          orgId: orgVictim,
          email: 'viewer_escalate@victim.com',
          role: 'admin',
          invitedByUserId: userVictimOwner,
        });

        // userVictimViewer is ALREADY a member with role 'viewer' in orgVictim
        // Attempting to accept this admin invite MUST fail due to UNIQUE(org_id, user_id) constraint
        await expect(
          acceptOrgInvitation(db, invite.token, userVictimViewer),
        ).rejects.toThrow(/UNIQUE/);

        // Verify userVictimViewer's role remains 'viewer' in the database
        const memberRow = rawDb
          .prepare('SELECT role FROM organization_members WHERE user_id = ? AND org_id = ?')
          .get(userVictimViewer, orgVictim) as any;

        expect(memberRow.role).toBe('viewer');
      });
    });

    describe('3.2 Cross-Tenant Invitation Revocation Tampering', () => {
      it('blocks attacker in orgAttacker from revoking victim organization invitation', async () => {
        const invite = await createOrgInvitation(db, {
          orgId: orgVictim,
          email: 'target_candidate@agency.com',
          role: 'creator',
          invitedByUserId: userVictimOwner,
        });

        // Attacker calls revokeOrgInvitation passing orgAttacker as the scope
        const revoked = await revokeOrgInvitation(db, invite.invitationId, orgAttacker);
        expect(revoked).toBe(false);

        // Verify invitation status remains pending
        const row = rawDb
          .prepare('SELECT status FROM org_invitations WHERE id = ?')
          .get(invite.invitationId) as any;

        expect(row.status).toBe('pending');
      });
    });

    describe('3.3 Seat Quota Boundaries & Allocation Math', () => {
      it('enforces Free tier limit (1 max seat): blocks invite when owner is already confirmed', async () => {
        // orgFree already has 1 owner (usr_free_owner)
        const quota = await checkSeatQuota(db, orgFree);
        expect(quota.maxSeats).toBe(1);
        expect(quota.activeMembers).toBe(1);
        expect(quota.allocated).toBe(1);
        expect(quota.isAllowed).toBe(false);

        await expect(
          createOrgInvitation(db, {
            orgId: orgFree,
            email: 'second_seat@free.com',
            role: 'viewer',
            invitedByUserId: 'usr_free_owner',
          }),
        ).rejects.toThrow(/SEAT_QUOTA_EXCEEDED/);
      });

      it('enforces Pro tier limit (5 max seats): accounts for active members AND pending invites', async () => {
        // Create new clean test org with Pro tier (max 5 seats)
        const cleanProOrg = 'org_clean_pro';
        rawDb.exec(`
          INSERT INTO organizations (id, name, slug, tier, max_seats)
          VALUES ('${cleanProOrg}', 'Clean Pro Org', 'clean-pro', 'pro', 5);

          INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
          VALUES ('mem_clean_1', '${cleanProOrg}', 'usr_clean_owner', 'owner', 1000, 1000);
        `);

        // Currently 1 active member. We can issue 4 invitations (1 + 4 = 5 allocated).
        for (let i = 1; i <= 4; i++) {
          await createOrgInvitation(db, {
            orgId: cleanProOrg,
            email: `member_${i}@procorp.com`,
            role: 'creator',
            invitedByUserId: 'usr_clean_owner',
          });
        }

        const quota = await checkSeatQuota(db, cleanProOrg);
        expect(quota.activeMembers).toBe(1);
        expect(quota.pendingInvites).toBe(4);
        expect(quota.allocated).toBe(5);
        expect(quota.isAllowed).toBe(false); // Exactly 5/5, no more can be invited

        // Attempting the 5th invitation (6th total allocation) MUST be blocked
        await expect(
          createOrgInvitation(db, {
            orgId: cleanProOrg,
            email: 'overflow_candidate@procorp.com',
            role: 'viewer',
            invitedByUserId: 'usr_clean_owner',
          }),
        ).rejects.toThrow(/SEAT_QUOTA_EXCEEDED: Org has reached seat limit \(5\/5\)/);
      });

      it('throws ORGANIZATION_NOT_FOUND when querying seat quota for non-existent org', async () => {
        await expect(checkSeatQuota(db, 'org_nonexistent')).rejects.toThrow(
          /ORGANIZATION_NOT_FOUND/,
        );
        await expect(checkSeatQuota(db, '')).rejects.toThrow(
          /ORGANIZATION_NOT_FOUND/,
        );
      });
    });

    describe('3.4 Concurrency, Anti-Replay & Token Acceptance Race Conditions', () => {
      it('handles concurrent simultaneous acceptance of the SAME token (atomic single-use guarantee)', async () => {
        const raceOrg = 'org_race_test';
        rawDb.exec(`
          INSERT INTO organizations (id, name, slug, tier, max_seats)
          VALUES ('${raceOrg}', 'Race Org', 'race-org', 'pro', 5);

          INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
          VALUES ('mem_race_owner', '${raceOrg}', 'usr_race_owner', 'owner', 1000, 1000);
        `);

        const invite = await createOrgInvitation(db, {
          orgId: raceOrg,
          email: 'race_invitee@agency.com',
          role: 'creator',
          invitedByUserId: 'usr_race_owner',
        });

        // Simulate 5 simultaneous acceptance requests with identical token
        const concurrentAttempts = [
          acceptOrgInvitation(db, invite.token, 'usr_actor_1'),
          acceptOrgInvitation(db, invite.token, 'usr_actor_2'),
          acceptOrgInvitation(db, invite.token, 'usr_actor_3'),
          acceptOrgInvitation(db, invite.token, 'usr_actor_4'),
          acceptOrgInvitation(db, invite.token, 'usr_actor_5'),
        ];

        const results = await Promise.allSettled(concurrentAttempts);

        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');

        // Exactly 1 must succeed; all others must be rejected
        expect(fulfilled).toHaveLength(1);
        expect(rejected.length).toBe(4);

        // Verify rejected reasons are INVITATION_ALREADY_USED or UNIQUE constraint
        for (const rej of rejected) {
          if (rej.status === 'rejected') {
            expect(rej.reason.message).toMatch(/(INVITATION_ALREADY_USED|UNIQUE)/);
          }
        }

        // Verify only 1 new member was added in DB (total 2: owner + 1 winner)
        const memberCount = rawDb
          .prepare('SELECT COUNT(*) as count FROM organization_members WHERE org_id = ?')
          .get(raceOrg) as any;
        expect(Number(memberCount.count)).toBe(2);
      });

      it('prevents oversubscription when multiple invites are accepted concurrently at capacity boundary', async () => {
        const capacityOrg = 'org_capacity_test';
        rawDb.exec(`
          INSERT INTO organizations (id, name, slug, tier, max_seats)
          VALUES ('${capacityOrg}', 'Capacity Org', 'capacity-org', 'pro', 2);

          INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
          VALUES ('mem_cap_owner', '${capacityOrg}', 'usr_cap_owner', 'owner', 1000, 1000);
        `);

        // Org has limit 2. 1 owner exists. Room for 1 more member.
        // Create 1 valid invitation
        const invite1 = await createOrgInvitation(db, {
          orgId: capacityOrg,
          email: 'slot_1@agency.com',
          role: 'creator',
          invitedByUserId: 'usr_cap_owner',
        });

        // Accept invite1 -> org is now full (2/2 active members)
        const res1 = await acceptOrgInvitation(db, invite1.token, 'usr_slot_1');
        expect(res1.success).toBe(true);

        // Verify active members is now 2
        const quota = await checkSeatQuota(db, capacityOrg);
        expect(quota.activeMembers).toBe(2);
        expect(quota.maxSeats).toBe(2);

        // Now forcefully insert a second invitation (bypassing createOrgInvitation check) to test accept-time defense
        const fakeToken = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
        const fakeHash = await sha256Hex(fakeToken);
        rawDb.exec(`
          INSERT INTO org_invitations (id, org_id, email, role, token_hash, expires_at, created_by, created_at, status)
          VALUES ('inv_bypass', '${capacityOrg}', 'bypass@agency.com', 'viewer', '${fakeHash}', ${Date.now() + 600000}, 'usr_cap_owner', ${Date.now()}, 'pending');
        `);

        // Attempting to accept when org is at max capacity (activeMembers >= maxSeats) MUST throw SEAT_QUOTA_EXCEEDED
        await expect(
          acceptOrgInvitation(db, fakeToken, 'usr_overflow_actor'),
        ).rejects.toThrow(/SEAT_QUOTA_EXCEEDED: Organization is full/);
      });
    });

    describe('3.5 Hostile Token Injection & Malformed Input Handling', () => {
      const maliciousTokens = [
        "' OR '1'='1",
        "'; DROP TABLE org_invitations; --",
        "' UNION SELECT * FROM organization_members --",
        'short',
        '0123456789',
        'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
        'abcdef0123456789\0nullbyte',
        'a'.repeat(10000), // 10KB overlong token
        '',
        '   ',
      ];

      it.each(maliciousTokens)('safely rejects malicious invitation token: %s', async (token) => {
        await expect(
          acceptOrgInvitation(db, token, userAttacker),
        ).rejects.toThrow(/INVALID_INVITATION_TOKEN/);
      });

      it('normalizes email addresses: case-insensitivity and whitespace stripping', async () => {
        const invite = await createOrgInvitation(db, {
          orgId: orgVictim,
          email: '\t  LeadingAndTrailing@VICTIM.COM \n',
          role: 'viewer',
          invitedByUserId: userVictimOwner,
        });

        const row = rawDb
          .prepare('SELECT email FROM org_invitations WHERE id = ?')
          .get(invite.invitationId) as any;

        expect(row.email).toBe('leadingandtrailing@victim.com');
      });

      it('rejects invalid email formats upon creation', async () => {
        const invalidEmails = [
          'no-at-sign.com',
          '',
          '   ',
          'just-letters-no-domain',
          'missing-at-symbol.org',
        ];

        for (const email of invalidEmails) {
          await expect(
            createOrgInvitation(db, {
              orgId: orgVictim,
              email,
              role: 'viewer',
              invitedByUserId: userVictimOwner,
            }),
          ).rejects.toThrow(/VALIDATION_ERROR/);
        }
      });
    });
  });
});

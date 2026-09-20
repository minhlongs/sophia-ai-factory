/**
 * Unit Test Suite: 5-Tier RBAC Permission Matrix & Typed Helper Predicates
 *
 * Validates:
 * 1. 25/25 Matrix Intersections across 5 roles and 5 permissions
 * 2. 5 Typed Helper Predicates
 * 3. Fail-Closed Assertion Guards & RbacPermissionError
 * 4. Privilege Escalation Prevention (Role Assignment & Member Management)
 * 5. Bilingual Metadata Invariants & Type Guards
 *
 * @module __tests__/unit/enterprise/rbac-matrix.test
 */

import { describe, it, expect } from 'vitest';
import {
  ALL_ORG_ROLES,
  ALL_ORG_PERMISSIONS,
  RBAC_PERMISSIONS_MATRIX,
  ROLE_METADATA,
  isOrgRole,
  isOrgPermission,
  type OrgRole,
  type OrgPermission,
} from '@/seed/types/rbac-matrix';
import {
  hasOrgPermission,
  canCreateMissions,
  canManageBilling,
  canInviteMembers,
  canPublishVideos,
  canConfigureWebhooks,
  assertOrgPermission,
  assertCanManageBilling,
  assertCanInviteMembers,
  canAssignRole,
  canManageMember,
  RbacPermissionError,
} from '@/tree/rbac/permissions';

describe('5-Tier RBAC Permission Matrix & Predicates', () => {
  describe('Pillar 1: Complete 25-Point Matrix Grid Verification', () => {
    const expectedMatrix: Record<OrgRole, Record<OrgPermission, boolean>> = {
      owner: {
        canCreateMissions: true,
        canManageBilling: true,
        canInviteMembers: true,
        canPublishVideos: true,
        canConfigureWebhooks: true,
      },
      admin: {
        canCreateMissions: true,
        canManageBilling: false, // Strict separation: Admin cannot alter billing!
        canInviteMembers: true,
        canPublishVideos: true,
        canConfigureWebhooks: true,
      },
      creator: {
        canCreateMissions: true,
        canManageBilling: false,
        canInviteMembers: false,
        canPublishVideos: true,
        canConfigureWebhooks: false,
      },
      billing_manager: {
        canCreateMissions: false,
        canManageBilling: true,
        canInviteMembers: false,
        canPublishVideos: false,
        canConfigureWebhooks: false,
      },
      viewer: {
        canCreateMissions: false,
        canManageBilling: false,
        canInviteMembers: false,
        canPublishVideos: false,
        canConfigureWebhooks: false,
      },
    };

    for (const role of ALL_ORG_ROLES) {
      for (const perm of ALL_ORG_PERMISSIONS) {
        const expected = expectedMatrix[role][perm];
        it(`evaluates ${role} -> ${perm} as ${expected}`, () => {
          expect(hasOrgPermission(role, perm)).toBe(expected);
        });
      }
    }
  });

  describe('Pillar 2: 5 Typed Helper Predicates', () => {
    it('canCreateMissions is granted to owner, admin, and creator only', () => {
      expect(canCreateMissions('owner')).toBe(true);
      expect(canCreateMissions('admin')).toBe(true);
      expect(canCreateMissions('creator')).toBe(true);
      expect(canCreateMissions('billing_manager')).toBe(false);
      expect(canCreateMissions('viewer')).toBe(false);
    });

    it('canManageBilling is granted to owner and billing_manager only', () => {
      expect(canManageBilling('owner')).toBe(true);
      expect(canManageBilling('billing_manager')).toBe(true);
      expect(canManageBilling('admin')).toBe(false);
      expect(canManageBilling('creator')).toBe(false);
      expect(canManageBilling('viewer')).toBe(false);
    });

    it('canInviteMembers is granted to owner and admin only', () => {
      expect(canInviteMembers('owner')).toBe(true);
      expect(canInviteMembers('admin')).toBe(true);
      expect(canInviteMembers('creator')).toBe(false);
      expect(canInviteMembers('billing_manager')).toBe(false);
      expect(canInviteMembers('viewer')).toBe(false);
    });

    it('canPublishVideos is granted to owner, admin, and creator only', () => {
      expect(canPublishVideos('owner')).toBe(true);
      expect(canPublishVideos('admin')).toBe(true);
      expect(canPublishVideos('creator')).toBe(true);
      expect(canPublishVideos('billing_manager')).toBe(false);
      expect(canPublishVideos('viewer')).toBe(false);
    });

    it('canConfigureWebhooks is granted to owner and admin only', () => {
      expect(canConfigureWebhooks('owner')).toBe(true);
      expect(canConfigureWebhooks('admin')).toBe(true);
      expect(canConfigureWebhooks('creator')).toBe(false);
      expect(canConfigureWebhooks('billing_manager')).toBe(false);
      expect(canConfigureWebhooks('viewer')).toBe(false);
    });
  });

  describe('Pillar 3: Assertion Guards & Error Handling', () => {
    it('assertOrgPermission does not throw when permission is held', () => {
      expect(() => assertOrgPermission('owner', 'canManageBilling')).not.toThrow();
      expect(() => assertOrgPermission('admin', 'canInviteMembers')).not.toThrow();
    });

    it('assertOrgPermission throws RbacPermissionError on missing permission', () => {
      expect(() => assertOrgPermission('admin', 'canManageBilling')).toThrow(RbacPermissionError);
      expect(() => assertCanManageBilling('admin')).toThrow(RbacPermissionError);
      expect(() => assertCanInviteMembers('creator')).toThrow(RbacPermissionError);
    });

    it('RbacPermissionError contains accurate role, permission, status 403, and message', () => {
      try {
        assertCanManageBilling('admin');
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(RbacPermissionError);
        const rbacErr = err as RbacPermissionError;
        expect(rbacErr.code).toBe('RBAC_PERMISSION_DENIED');
        expect(rbacErr.status).toBe(403);
        expect(rbacErr.role).toBe('admin');
        expect(rbacErr.permission).toBe('canManageBilling');
      }
    });

    it('fails closed on unknown or malformed role / permission inputs', () => {
      expect(hasOrgPermission('superadmin' as OrgRole, 'canCreateMissions')).toBe(false);
      expect(hasOrgPermission('owner', 'unknownPermission' as OrgPermission)).toBe(false);
      expect(hasOrgPermission('', '')).toBe(false);
    });
  });

  describe('Pillar 4: Privilege Escalation Prevention', () => {
    it('owner can delegate all roles except transfer ownership directly', () => {
      expect(canAssignRole('owner', 'admin')).toBe(true);
      expect(canAssignRole('owner', 'creator')).toBe(true);
      expect(canAssignRole('owner', 'billing_manager')).toBe(true);
      expect(canAssignRole('owner', 'viewer')).toBe(true);
      expect(canAssignRole('owner', 'owner')).toBe(false);
    });

    it('admin cannot assign owner or another admin', () => {
      expect(canAssignRole('admin', 'owner')).toBe(false);
      expect(canAssignRole('admin', 'admin')).toBe(false);
      expect(canAssignRole('admin', 'creator')).toBe(true);
      expect(canAssignRole('admin', 'billing_manager')).toBe(true);
      expect(canAssignRole('admin', 'viewer')).toBe(true);
    });

    it('creator, billing_manager, and viewer cannot assign any roles', () => {
      for (const nonAdmin of ['creator', 'billing_manager', 'viewer'] as const) {
        for (const targetRole of ALL_ORG_ROLES) {
          expect(canAssignRole(nonAdmin, targetRole)).toBe(false);
        }
      }
    });

    it('member management respects hierarchy and protects owner from demotion', () => {
      expect(canManageMember('owner', 'admin')).toBe(true);
      expect(canManageMember('owner', 'creator')).toBe(true);
      expect(canManageMember('owner', 'owner')).toBe(false);

      expect(canManageMember('admin', 'creator')).toBe(true);
      expect(canManageMember('admin', 'viewer')).toBe(true);
      expect(canManageMember('admin', 'admin')).toBe(false);
      expect(canManageMember('admin', 'owner')).toBe(false);

      expect(canManageMember('creator', 'viewer')).toBe(false);
      expect(canManageMember('viewer', 'viewer')).toBe(false);
    });
  });

  describe('Pillar 5: Bilingual Metadata & Type Guards', () => {
    it('all 5 roles have valid English and Vietnamese metadata', () => {
      for (const role of ALL_ORG_ROLES) {
        const meta = ROLE_METADATA[role];
        expect(meta).toBeDefined();
        expect(meta.nameEn.length).toBeGreaterThan(0);
        expect(meta.nameVi.length).toBeGreaterThan(0);
        expect(meta.descriptionEn.length).toBeGreaterThan(0);
        expect(meta.descriptionVi.length).toBeGreaterThan(0);
        expect(meta.permissions).toEqual(RBAC_PERMISSIONS_MATRIX[role]);
      }
    });

    it('isOrgRole and isOrgPermission type guards validate cleanly', () => {
      expect(isOrgRole('owner')).toBe(true);
      expect(isOrgRole('creator')).toBe(true);
      expect(isOrgRole('superman')).toBe(false);

      expect(isOrgPermission('canCreateMissions')).toBe(true);
      expect(isOrgPermission('canManageBilling')).toBe(true);
      expect(isOrgPermission('canHackSystem')).toBe(false);
    });
  });
});

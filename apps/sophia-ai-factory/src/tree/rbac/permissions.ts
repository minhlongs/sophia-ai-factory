/**
 * 5-Tier RBAC Permission Evaluator & Assertion Guards
 *
 * Implements granular role-based access control evaluation:
 * - Core evaluator: `hasOrgPermission`
 * - 5 Typed helper predicates: `canCreateMissions`, `canManageBilling`, `canInviteMembers`, `canPublishVideos`, `canConfigureWebhooks`
 * - Fail-closed assertion guards throwing `RbacPermissionError`
 * - Anti-privilege escalation delegation checks: `canAssignRole`, `canManageMember`
 *
 * Layer: tree/rbac (Pure Domain Logic - only imports from @/seed)
 *
 * @module tree/rbac/permissions
 */

import {
  ROLE_PERMISSION_FLAGS,
  type OrgRole,
  type OrgPermission,
  isOrgRole,
  isOrgPermission,
} from '@/seed/types/rbac-matrix';

export class RbacPermissionError extends Error {
  readonly code = 'RBAC_PERMISSION_DENIED' as const;
  readonly status = 403;
  readonly role: string;
  readonly permission: string;

  constructor(role: string, permission: string) {
    super(`RBAC_PERMISSION_DENIED: Role '${role}' lacks permission '${permission}'`);
    this.name = 'RbacPermissionError';
    this.role = role;
    this.permission = permission;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Evaluates whether a given organization role possesses the specified permission.
 * Evaluates in O(1) time using precomputed boolean flags. Fails closed on invalid inputs.
 */
export function hasOrgPermission(role: OrgRole | string, permission: OrgPermission | string): boolean {
  if (!isOrgRole(role) || !isOrgPermission(permission)) {
    return false;
  }
  return ROLE_PERMISSION_FLAGS[role]?.[permission] ?? false;
}

// ─── 5 TYPED HELPER PREDICATES ─────────────────────────────────────────────

export function canCreateMissions(role: OrgRole | string): boolean {
  return hasOrgPermission(role, 'canCreateMissions');
}

export function canManageBilling(role: OrgRole | string): boolean {
  return hasOrgPermission(role, 'canManageBilling');
}

export function canInviteMembers(role: OrgRole | string): boolean {
  return hasOrgPermission(role, 'canInviteMembers');
}

export function canPublishVideos(role: OrgRole | string): boolean {
  return hasOrgPermission(role, 'canPublishVideos');
}

export function canConfigureWebhooks(role: OrgRole | string): boolean {
  return hasOrgPermission(role, 'canConfigureWebhooks');
}

// ─── ASSERTION GUARDS (FAIL CLOSED) ──────────────────────────────────────────

export function assertOrgPermission(role: OrgRole | string, permission: OrgPermission | string): void {
  if (!hasOrgPermission(role, permission)) {
    throw new RbacPermissionError(String(role), String(permission));
  }
}

export function assertCanCreateMissions(role: OrgRole | string): void {
  assertOrgPermission(role, 'canCreateMissions');
}

export function assertCanManageBilling(role: OrgRole | string): void {
  assertOrgPermission(role, 'canManageBilling');
}

export function assertCanInviteMembers(role: OrgRole | string): void {
  assertOrgPermission(role, 'canInviteMembers');
}

export function assertCanPublishVideos(role: OrgRole | string): void {
  assertOrgPermission(role, 'canPublishVideos');
}

export function assertCanConfigureWebhooks(role: OrgRole | string): void {
  assertOrgPermission(role, 'canConfigureWebhooks');
}

// ─── ROLE DELEGATION & PRIVILEGE ESCALATION GUARDS ───────────────────────────

/**
 * Checks if an actor can assign a given target role to another member.
 * Prevents horizontal and vertical privilege escalation.
 */
export function canAssignRole(actorRole: OrgRole | string, targetRole: OrgRole | string): boolean {
  if (!isOrgRole(actorRole) || !isOrgRole(targetRole)) return false;

  if (actorRole === 'owner') {
    // Owner can assign any non-owner role (ownership transfer is a separate dedicated flow)
    return targetRole !== 'owner';
  }

  if (actorRole === 'admin') {
    // Admin can only assign non-admin, non-owner roles
    return targetRole === 'creator' || targetRole === 'billing_manager' || targetRole === 'viewer';
  }

  // creator, billing_manager, and viewer cannot assign roles
  return false;
}

/**
 * Checks if an actor can mutate, demote, or remove a member with targetMemberRole.
 */
export function canManageMember(actorRole: OrgRole | string, targetMemberRole: OrgRole | string): boolean {
  if (!isOrgRole(actorRole) || !isOrgRole(targetMemberRole)) return false;

  if (actorRole === 'owner') {
    // Owner can manage all members except other owners
    return targetMemberRole !== 'owner';
  }

  if (actorRole === 'admin') {
    // Admin can manage creators, billing managers, and viewers
    return (
      targetMemberRole === 'creator' ||
      targetMemberRole === 'billing_manager' ||
      targetMemberRole === 'viewer'
    );
  }

  return false;
}

/**
 * Role Delegation & Privilege Escalation Guards
 *
 * Layer: tree/rbac (Pure Domain Logic - only imports from @/seed)
 * @module tree/rbac/role-delegation-guards
 */

import { type OrgRole, isOrgRole } from '@/seed/types/rbac-matrix';

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

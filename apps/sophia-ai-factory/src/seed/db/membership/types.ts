/**
 * Organization Membership Types & Constants
 * Layer: seed/db/membership
 */

import { type OrgRole } from '@/seed/auth/rbac'
export type { OrgRole }

/**
 * Organization member roles.
 * - owner: created the org, cannot be removed or demoted
 * - admin: can manage members (invite/remove/change roles)
 * - member: can use all features
 * - viewer: read-only access
 */
export const ORG_ROLES: OrgRole[] = ['owner', 'admin', 'member', 'viewer']

/** Roles that have member management permissions */
export const MANAGER_ROLES: OrgRole[] = ['owner', 'admin']

export interface OrgMembership {
  orgId: string;
  role: OrgRole;
}

export type OrgCheckResult =
  | { authorized: true; orgId: string; role: OrgRole }
  | { authorized: false; error: string }

export interface OrgMemberRow {
  id: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
  email?: string;
  name?: string;
}

export interface OrgMemberWithDetails extends OrgMemberRow {
  email: string;
  name: string;
}

/**
 * RBAC permission matrix for org-level role-based access control.
 *
 * Role hierarchy: owner > admin > member > viewer
 *
 * owner   – full control: billing, branding, members, SOPs, API keys
 * admin   – no billing/settings changes, but everything else
 * member  – SOP creation + publishing, analytics, member view
 * viewer  – install SOPs, view analytics, view members
 *
 * @module seed/auth/rbac
 */

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';

export type Permission =
  | 'org:manage'    // manage org settings, billing
  | 'org:invite'    // invite/remove members
  | 'org:branding'  // manage white-label branding
  | 'sop:create'    // create SOPs
  | 'sop:publish'   // publish SOPs marketplace
  | 'sop:install'   // install SOPs
  | 'api:manage'    // manage API keys
  | 'billing:view'  // view billing
  | 'analytics:view' // view analytics
  | 'members:view'; // view member list

/**
 * Permission matrix: which roles have which permissions.
 * Ordered by descending privilege for readability.
 */
export const ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  owner: [
    'org:manage',
    'org:invite',
    'org:branding',
    'sop:create',
    'sop:publish',
    'sop:install',
    'api:manage',
    'billing:view',
    'analytics:view',
    'members:view',
  ],
  admin: [
    'org:invite',
    'org:branding',
    'sop:create',
    'sop:publish',
    'sop:install',
    'api:manage',
    'billing:view',
    'analytics:view',
    'members:view',
  ],
  member: [
    'sop:create',
    'sop:publish',
    'sop:install',
    'analytics:view',
    'members:view',
  ],
  viewer: [
    'sop:install',
    'analytics:view',
    'members:view',
  ],
} as const;

/**
 * Check whether a role has a specific permission.
 *
 * @example
 * hasPermission('admin', 'org:invite') // true
 * hasPermission('viewer', 'sop:create') // false
 */
export function hasPermission(role: OrgRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Get all permissions assigned to a role.
 * Returns an empty array for unknown roles.
 */
export function getRolePermissions(role: OrgRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

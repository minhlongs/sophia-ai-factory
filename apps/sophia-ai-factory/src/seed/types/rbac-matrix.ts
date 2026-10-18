/**
 * 5-Tier RBAC Permission Matrix & Role Contracts (Enterprise Scale)
 *
 * Defines the enterprise role hierarchy:
 * - owner: Full administrative and billing authority (5/5)
 * - admin: Operational administrator, excluded from billing mutation (4/5)
 * - creator: Content generation and publishing (2/5)
 * - billing_manager: Dedicated financial and subscription management (1/5)
 * - viewer: Read-only visibility across organization resources (0/5)
 *
 * Layer: seed/types (Foundational - 0 dependencies)
 *
 * @module seed/types/rbac-matrix
 */

import { buildRoleMetadata, type OrgRoleMetadata } from './rbac-metadata';

export type { OrgRoleMetadata };

export type OrgRole = 'owner' | 'admin' | 'creator' | 'billing_manager' | 'viewer';

export type OrgPermission =
  | 'canCreateMissions'
  | 'canManageBilling'
  | 'canInviteMembers'
  | 'canPublishVideos'
  | 'canConfigureWebhooks';

export const ALL_ORG_ROLES: readonly OrgRole[] = [
  'owner',
  'admin',
  'creator',
  'billing_manager',
  'viewer',
] as const;

export const ALL_ORG_PERMISSIONS: readonly OrgPermission[] = [
  'canCreateMissions',
  'canManageBilling',
  'canInviteMembers',
  'canPublishVideos',
  'canConfigureWebhooks',
] as const;

/**
 * Canonical 5-Tier RBAC Permission Matrix mapping each role to granted permissions.
 */
export const RBAC_PERMISSIONS_MATRIX: Record<OrgRole, readonly OrgPermission[]> = {
  owner: [
    'canCreateMissions',
    'canManageBilling',
    'canInviteMembers',
    'canPublishVideos',
    'canConfigureWebhooks',
  ],
  admin: [
    'canCreateMissions',
    'canInviteMembers',
    'canPublishVideos',
    'canConfigureWebhooks',
  ],
  creator: [
    'canCreateMissions',
    'canPublishVideos',
  ],
  billing_manager: [
    'canManageBilling',
  ],
  viewer: [],
} as const;

/**
 * Precomputed boolean flags for O(1) instant matrix evaluation in critical paths.
 */
export const ROLE_PERMISSION_FLAGS: Record<OrgRole, Record<OrgPermission, boolean>> = {
  owner: {
    canCreateMissions: true,
    canManageBilling: true,
    canInviteMembers: true,
    canPublishVideos: true,
    canConfigureWebhooks: true,
  },
  admin: {
    canCreateMissions: true,
    canManageBilling: false, // Strict separation of duties: Admin cannot mutate billing
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
} as const;

export const ROLE_METADATA: Record<OrgRole, OrgRoleMetadata> = buildRoleMetadata(
  RBAC_PERMISSIONS_MATRIX,
);

/**
 * Type guard to check if a string is a valid OrgRole.
 */
export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === 'string' && ALL_ORG_ROLES.includes(value as OrgRole);
}

/**
 * Type guard to check if a string is a valid OrgPermission.
 */
export function isOrgPermission(value: unknown): value is OrgPermission {
  return typeof value === 'string' && ALL_ORG_PERMISSIONS.includes(value as OrgPermission);
}

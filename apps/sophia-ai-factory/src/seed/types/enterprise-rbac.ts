/**
 * 4-Tier Enterprise Multi-Org RBAC Contracts & Permission Matrix
 *
 * Layer: seed/types (Foundational - 0 dependencies)
 * @module seed/types/enterprise-rbac
 */

export type EnterpriseRole =
  | 'enterprise_admin'
  | 'creative_director'
  | 'video_editor'
  | 'reviewer';

export type EnterprisePermission =
  | 'canManageEnterpriseSso'
  | 'canViewAuditVault'
  | 'canTriggerAuditVerification'
  | 'canApproveVideoReview'
  | 'canPublishVideo'
  | 'canEditVideoScripts'
  | 'canManageMembers'
  | 'canManageBilling'
  | 'canConfigureBranding';

export const ALL_ENTERPRISE_ROLES: readonly EnterpriseRole[] = [
  'enterprise_admin',
  'creative_director',
  'video_editor',
  'reviewer',
] as const;

export const ALL_ENTERPRISE_PERMISSIONS: readonly EnterprisePermission[] = [
  'canManageEnterpriseSso',
  'canViewAuditVault',
  'canTriggerAuditVerification',
  'canApproveVideoReview',
  'canPublishVideo',
  'canEditVideoScripts',
  'canManageMembers',
  'canManageBilling',
  'canConfigureBranding',
] as const;

/**
 * Precomputed boolean flags for O(1) instant matrix evaluation in critical paths.
 */
export const ENTERPRISE_ROLE_PERMISSION_FLAGS: Record<
  EnterpriseRole,
  Record<EnterprisePermission, boolean>
> = {
  enterprise_admin: {
    canManageEnterpriseSso: true,
    canViewAuditVault: true,
    canTriggerAuditVerification: true,
    canApproveVideoReview: true,
    canPublishVideo: true,
    canEditVideoScripts: true,
    canManageMembers: true,
    canManageBilling: true,
    canConfigureBranding: true,
  },
  creative_director: {
    canManageEnterpriseSso: false,
    canViewAuditVault: true,
    canTriggerAuditVerification: false,
    canApproveVideoReview: true,
    canPublishVideo: true,
    canEditVideoScripts: true,
    canManageMembers: false,
    canManageBilling: false,
    canConfigureBranding: true,
  },
  video_editor: {
    canManageEnterpriseSso: false,
    canViewAuditVault: false,
    canTriggerAuditVerification: false,
    canApproveVideoReview: false,
    canPublishVideo: false,
    canEditVideoScripts: true,
    canManageMembers: false,
    canManageBilling: false,
    canConfigureBranding: false,
  },
  reviewer: {
    canManageEnterpriseSso: false,
    canViewAuditVault: false,
    canTriggerAuditVerification: false,
    canApproveVideoReview: true,
    canPublishVideo: false,
    canEditVideoScripts: false,
    canManageMembers: false,
    canManageBilling: false,
    canConfigureBranding: false,
  },
} as const;

export {
  ENTERPRISE_ROLE_METADATA,
  hasEnterprisePermission,
  getEnterprisePermissions,
  isEnterpriseRole,
  isEnterprisePermission,
  type EnterpriseRoleMetadata,
} from './enterprise-rbac-metadata';

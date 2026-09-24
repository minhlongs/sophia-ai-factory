/**
 * 4-Tier Enterprise Multi-Org RBAC Contracts & Permission Matrix
 *
 * Defines the enterprise role hierarchy:
 * - enterprise_admin: Full administrative control over organization, SSO settings, white-label, audit vault, team members, and billing.
 * - creative_director: Manages brand guidelines, approves video drafts, defines campaign playbooks, creates and publishes missions.
 * - video_editor: Executes video generation runs, edits scripts, configures audio/visual tracks, submits videos for review.
 * - reviewer: Read-only access to video drafts, comments, and marks approval/rejection without mutation permissions on configs or billing.
 *
 * Layer: seed/types (Foundational - 0 dependencies)
 *
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

export interface EnterpriseRoleMetadata {
  readonly role: EnterpriseRole;
  readonly nameEn: string;
  readonly nameVi: string;
  readonly descriptionEn: string;
  readonly descriptionVi: string;
  readonly permissions: readonly EnterprisePermission[];
}

export const ENTERPRISE_ROLE_METADATA: Record<EnterpriseRole, EnterpriseRoleMetadata> = {
  enterprise_admin: {
    role: 'enterprise_admin',
    nameEn: 'Enterprise Admin',
    nameVi: 'Quản trị viên Doanh nghiệp',
    descriptionEn: 'Full administrative control over organization, SSO settings, audit vault, team, and billing.',
    descriptionVi: 'Quyền quản trị toàn diện về tổ chức, cài đặt SSO, kho nhật ký kiểm toán, nhân sự và thanh toán.',
    permissions: ALL_ENTERPRISE_PERMISSIONS,
  },
  creative_director: {
    role: 'creative_director',
    nameEn: 'Creative Director',
    nameVi: 'Giám đốc Sản xuất',
    descriptionEn: 'Oversees brand guidelines, approves video drafts, views audit logs, and publishes missions.',
    descriptionVi: 'Phụ trách nhận diện thương hiệu, phê duyệt bản nháp video, xem nhật ký kiểm toán và xuất bản chiến dịch.',
    permissions: [
      'canViewAuditVault',
      'canApproveVideoReview',
      'canPublishVideo',
      'canEditVideoScripts',
      'canConfigureBranding',
    ],
  },
  video_editor: {
    role: 'video_editor',
    nameEn: 'Video Editor',
    nameVi: 'Kỹ thuật viên Video',
    descriptionEn: 'Generates videos, edits scripts, configures audio tracks, and submits videos for review.',
    descriptionVi: 'Thực thi kết xuất video, biên tập kịch bản, cấu hình âm thanh và gửi video để xét duyệt.',
    permissions: ['canEditVideoScripts'],
  },
  reviewer: {
    role: 'reviewer',
    nameEn: 'Reviewer',
    nameVi: 'Người xem Xét duyệt',
    descriptionEn: 'Reviews video drafts, leaves feedback, and grants approval or rejection.',
    descriptionVi: 'Xem trước bản nháp video, gửi phản hồi và phê duyệt hoặc từ chối phát hành.',
    permissions: ['canApproveVideoReview'],
  },
};

/**
 * Check if a role possesses a specific permission.
 */
export function hasEnterprisePermission(
  role: EnterpriseRole,
  permission: EnterprisePermission,
): boolean {
  return ENTERPRISE_ROLE_PERMISSION_FLAGS[role]?.[permission] ?? false;
}

/**
 * Get all granted permissions for a given enterprise role.
 */
export function getEnterprisePermissions(role: EnterpriseRole): readonly EnterprisePermission[] {
  return ENTERPRISE_ROLE_METADATA[role]?.permissions ?? [];
}

/**
 * Type guard to check if a string is a valid EnterpriseRole.
 */
export function isEnterpriseRole(value: unknown): value is EnterpriseRole {
  return typeof value === 'string' && ALL_ENTERPRISE_ROLES.includes(value as EnterpriseRole);
}

/**
 * Type guard to check if a string is a valid EnterprisePermission.
 */
export function isEnterprisePermission(value: unknown): value is EnterprisePermission {
  return typeof value === 'string' && ALL_ENTERPRISE_PERMISSIONS.includes(value as EnterprisePermission);
}

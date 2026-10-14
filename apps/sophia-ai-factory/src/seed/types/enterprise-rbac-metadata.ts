/**
 * Enterprise RBAC Metadata & Guard Helpers
 *
 * Layer: seed/types (Foundational - 0 dependencies)
 * @module seed/types/enterprise-rbac-metadata
 */

import {
  ALL_ENTERPRISE_PERMISSIONS,
  ALL_ENTERPRISE_ROLES,
  ENTERPRISE_ROLE_PERMISSION_FLAGS,
  type EnterprisePermission,
  type EnterpriseRole,
} from './enterprise-rbac';

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
    descriptionEn:
      'Full administrative control over organization, SSO settings, audit vault, team, and billing.',
    descriptionVi:
      'Quyền quản trị toàn diện về tổ chức, cài đặt SSO, kho nhật ký kiểm toán, nhân sự và thanh toán.',
    permissions: ALL_ENTERPRISE_PERMISSIONS,
  },
  creative_director: {
    role: 'creative_director',
    nameEn: 'Creative Director',
    nameVi: 'Giám đốc Sản xuất',
    descriptionEn:
      'Oversees brand guidelines, approves video drafts, views audit logs, and publishes missions.',
    descriptionVi:
      'Phụ trách nhận diện thương hiệu, phê duyệt bản nháp video, xem nhật ký kiểm toán và xuất bản chiến dịch.',
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
    descriptionEn:
      'Generates videos, edits scripts, configures audio tracks, and submits videos for review.',
    descriptionVi:
      'Thực thi kết xuất video, biên tập kịch bản, cấu hình âm thanh và gửi video để xét duyệt.',
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

export function hasEnterprisePermission(
  role: EnterpriseRole,
  permission: EnterprisePermission,
): boolean {
  return ENTERPRISE_ROLE_PERMISSION_FLAGS[role]?.[permission] ?? false;
}

export function getEnterprisePermissions(role: EnterpriseRole): readonly EnterprisePermission[] {
  return ENTERPRISE_ROLE_METADATA[role]?.permissions ?? [];
}

export function isEnterpriseRole(value: unknown): value is EnterpriseRole {
  return typeof value === 'string' && ALL_ENTERPRISE_ROLES.includes(value as EnterpriseRole);
}

export function isEnterprisePermission(value: unknown): value is EnterprisePermission {
  return (
    typeof value === 'string' &&
    ALL_ENTERPRISE_PERMISSIONS.includes(value as EnterprisePermission)
  );
}

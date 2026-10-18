/**
 * Bilingual Role Metadata for 5-Tier RBAC Matrix
 *
 * Layer: seed/types
 * @module seed/types/rbac-metadata
 */

import type { OrgPermission, OrgRole } from './rbac-matrix';

export interface OrgRoleMetadata {
  readonly role: OrgRole;
  readonly nameEn: string;
  readonly nameVi: string;
  readonly descriptionEn: string;
  readonly descriptionVi: string;
  readonly permissions: readonly OrgPermission[];
}

export function buildRoleMetadata(
  matrix: Record<OrgRole, readonly OrgPermission[]>,
): Record<OrgRole, OrgRoleMetadata> {
  return {
    owner: {
      role: 'owner',
      nameEn: 'Owner',
      nameVi: 'Chủ sở hữu',
      descriptionEn: 'Full administrative and financial control over the organization.',
      descriptionVi: 'Quyền kiểm soát toàn diện về quản trị và tài chính của tổ chức.',
      permissions: matrix.owner,
    },
    admin: {
      role: 'admin',
      nameEn: 'Administrator',
      nameVi: 'Quản trị viên',
      descriptionEn: 'Operational manager with member invite, mission, and webhook permissions.',
      descriptionVi: 'Quản lý vận hành có quyền mời thành viên, tạo chiến dịch và quản lý webhook.',
      permissions: matrix.admin,
    },
    creator: {
      role: 'creator',
      nameEn: 'Creator',
      nameVi: 'Nhà sáng tạo',
      descriptionEn: 'Content generator with video creation and publishing permissions.',
      descriptionVi: 'Người sáng tạo nội dung có quyền tạo video và đăng tải lên mạng xã hội.',
      permissions: matrix.creator,
    },
    billing_manager: {
      role: 'billing_manager',
      nameEn: 'Billing Manager',
      nameVi: 'Quản lý thanh toán',
      descriptionEn: 'Dedicated finance officer managing payment methods, invoices, and subscriptions.',
      descriptionVi: 'Quản lý tài chính phụ trách phương thức thanh toán, hóa đơn và gói đăng ký.',
      permissions: matrix.billing_manager,
    },
    viewer: {
      role: 'viewer',
      nameEn: 'Viewer',
      nameVi: 'Người xem',
      descriptionEn: 'Read-only access for stakeholders, auditors, and clients.',
      descriptionVi: 'Quyền chỉ xem dành cho các bên liên quan, kiểm toán viên và khách hàng.',
      permissions: matrix.viewer,
    },
  };
}

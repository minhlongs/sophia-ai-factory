/**
 * Collaboration Utilities
 */

import type { UserRole, PermissionCheck } from '@/types/collaboration';

export const ROLE_PERMISSIONS: Record<UserRole, PermissionCheck> = {
  owner: {
    canEdit: true,
    canComment: true,
    canShare: true,
    canDelete: true,
  },
  admin: {
    canEdit: true,
    canComment: true,
    canShare: true,
    canDelete: false,
  },
  editor: {
    canEdit: true,
    canComment: true,
    canShare: false,
    canDelete: false,
  },
  viewer: {
    canEdit: false,
    canComment: true,
    canShare: false,
    canDelete: false,
  },
};

export function checkPermission(
  role: UserRole,
  action: 'edit' | 'comment' | 'share' | 'delete'
): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  switch (action) {
    case 'edit':
      return permissions.canEdit;
    case 'comment':
      return permissions.canComment;
    case 'share':
      return permissions.canShare;
    case 'delete':
      return permissions.canDelete;
    default:
      return false;
  }
}

export function getRoleColor(role: UserRole): string {
  const colors = {
    owner: 'bg-purple-500',
    admin: 'bg-blue-500',
    editor: 'bg-green-500',
    viewer: 'bg-gray-400',
  };
  return colors[role];
}

export function formatUsersList(users: Array<{ name: string }>): string {
  if (users.length === 0) return 'No one';
  if (users.length === 1) return users[0].name;
  if (users.length === 2) return `${users[0].name} and ${users[1].name}`;
  return `${users[0].name} and ${users.length - 1} others`;
}

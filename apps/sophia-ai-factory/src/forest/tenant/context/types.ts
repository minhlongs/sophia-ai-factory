/**
 * Tenant Context Types and Constants
 *
 * Layer: forest/tenant/context
 */
import type { OrgRole } from '@/seed/types/rbac-matrix';
export const ACTIVE_ORG_COOKIE = 'active_org_id';
export const ACTIVE_ORG_HEADER = 'x-active-org-id';
export const FALLBACK_ORG_HEADER = 'x-org-id';
export interface ActiveOrgContext {
  readonly orgId: string;
  readonly orgName: string;
  readonly slug: string;
  readonly role: OrgRole;
  readonly tier: string;
  readonly userId: string;
  readonly userEmail?: string;
}
export interface UserOrgMembership {
  readonly orgId: string;
  readonly orgName: string;
  readonly slug: string;
  readonly role: OrgRole;
  readonly tier: string;
  readonly maxSeats: number;
  readonly isOwner: boolean;
  readonly isActiveContext: boolean;
  readonly joinedAt: number;
}
export type ContextSwitchErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_ORG_ID'
  | 'MEMBERSHIP_NOT_FOUND'
  | 'ORGANIZATION_INACTIVE'
  | 'ORGANIZATION_NOT_FOUND'
  | 'DB_UNAVAILABLE';
export class OrgContextError extends Error {
  readonly code: ContextSwitchErrorCode;
  readonly orgId?: string;
  readonly userId?: string;
  constructor(
    message: string,
    code: ContextSwitchErrorCode,
    orgId?: string,
    userId?: string,
  ) {
    super(message);
    this.name = 'OrgContextError';
    this.code = code;
    this.orgId = orgId;
    this.userId = userId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

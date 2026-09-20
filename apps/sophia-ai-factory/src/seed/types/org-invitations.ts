/**
 * Multi-User Organization Invitation Contracts & Quota Types
 *
 * Defines the cryptographic invitation lifecycle types, seat quota interfaces,
 * and database record models.
 *
 * Layer: seed/types (Foundational)
 *
 * @module seed/types/org-invitations
 */

import type { OrgRole } from './rbac-matrix';

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface OrgInvitationRecord {
  id: string;
  org_id: string;
  email: string;
  role: OrgRole;
  token_hash: string;
  expires_at: number;
  accepted_at?: number | null;
  created_by: string;
  invited_by?: string;
  created_at: number;
  status: InvitationStatus;
}

export interface CreateInvitationInput {
  orgId: string;
  email: string;
  role: OrgRole;
  invitedByUserId: string;
  appBaseUrl?: string;
}

export interface CreateInvitationResult {
  invitationId: string;
  inviteUrl: string;
  token: string; // Plaintext token returned ONCE to inviter
  expiresAt: number;
}

export interface AcceptInvitationResult {
  success: boolean;
  orgId: string;
  role: OrgRole;
}

export interface SeatQuotaCheckResult {
  allocated: number;
  activeMembers: number;
  pendingInvites: number;
  maxSeats: number;
  isAllowed: boolean;
  tier: string;
}

export type InvitationErrorCode =
  | 'INVALID_INVITATION_TOKEN'
  | 'INVITATION_ALREADY_USED'
  | 'INVITATION_EXPIRED'
  | 'SEAT_QUOTA_EXCEEDED'
  | 'INVITATION_ALREADY_PENDING'
  | 'ORGANIZATION_NOT_FOUND'
  | 'CROSS_TENANT_VIOLATION'
  | 'UNAUTHORIZED';

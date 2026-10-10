/**
 * Organization Invitation Types
 * Layer: tree/organizations (Pure domain types)
 */

import type { OrgRole } from '@/seed/types/rbac-matrix';
import type {
  CreateInvitationInput,
  CreateInvitationResult,
  AcceptInvitationResult,
  OrgInvitationRecord,
} from '@/seed/types/org-invitations';

export type { CreateInvitationInput, CreateInvitationResult, AcceptInvitationResult, OrgInvitationRecord };

export interface NormalizedInvitationParams {
  orgId: string;
  email: string;
  role: OrgRole;
  invitedByUserId: string;
  appBaseUrl?: string;
}

export interface InsertInvitationParams {
  invitationId: string;
  orgId: string;
  email: string;
  role: OrgRole;
  tokenHash: string;
  expiresAt: number;
  invitedByUserId: string;
  now: number;
  maxSeats: number;
  allocated: number;
}

export interface OrgInvitationLookup {
  id: string;
  org_id: string;
  email: string;
  role: OrgRole;
  status: string;
  expires_at: number;
}

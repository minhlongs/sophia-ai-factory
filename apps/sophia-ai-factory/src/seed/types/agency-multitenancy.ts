/**
 * Agency Multi-Tenancy & Client Sub-Account Domain Types
 *
 * Implements canonical contracts for:
 * - Client Sub-Accounts with branding and MCU quota
 * - RBAC Hierarchy (Agency Owner, Video Editor, Client Reviewer)
 * - Video Review Payload & Feedback Comments
 * - Review token records and lifecycle operations
 *
 * Layer: seed/types (Foundational data contracts - zero imports from upper layers)
 *
 * @module seed/types/agency-multitenancy
 */

export type SubaccountRole = 'agency_owner' | 'video_editor' | 'client_reviewer';

export type SubaccountStatus = 'ACTIVE' | 'SUSPENDED' | 'active' | 'suspended' | 'archived';

export interface SubaccountBranding {
  subaccountId: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubaccountMcuQuota {
  allocated: number;
  used: number;
  remaining: number;
}

export interface SubaccountMcuAllocation {
  id: string;
  subaccountId: string;
  allocatedMcu: number;
  usedMcu: number;
  remainingMcu: number;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubaccountMember {
  id: string;
  subaccountId: string;
  userId: string;
  role: SubaccountRole;
  createdAt: string;
}

export interface ClientSubaccount {
  id: string;
  agencyOrgId: string;
  name: string;
  slug: string;
  customDomain?: string;
  branding: {
    logoUrl?: string;
    primaryColor?: string;
    accentColor?: string;
  };
  mcuQuota: SubaccountMcuQuota;
  status: 'ACTIVE' | 'SUSPENDED';
}

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'pending' | 'approved' | 'changes_requested';

export interface FeedbackComment {
  timestampSec?: number;
  author: string;
  comment: string;
  createdAt: string;
}

export interface VideoReviewPayload {
  token: string;
  subaccountId: string;
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  status: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
  feedbackComments?: FeedbackComment[];
  subaccountBranding?: {
    logoUrl?: string;
    primaryColor?: string;
    accentColor?: string;
    clientName?: string;
  };
  expiresAt?: string;
  isExpired?: boolean;
}

export interface VideoReviewRecord {
  id: string;
  subaccountId: string;
  videoId: string;
  videoTitle?: string;
  videoUrl?: string;
  tokenHash: string;
  status: 'pending' | 'approved' | 'changes_requested';
  feedbackComments: FeedbackComment[];
  reviewedAt?: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface CreateSubaccountInput {
  agencyOrgId: string;
  name: string;
  slug?: string;
  customDomain?: string;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    accentColor?: string;
  };
  initialMcu?: number;
}

export interface UpdateSubaccountInput {
  name?: string;
  slug?: string;
  customDomain?: string | null;
  status?: 'active' | 'suspended' | 'archived' | 'ACTIVE' | 'SUSPENDED';
}

export interface UpdateBrandingInput {
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
}

export interface AllocateMcuInput {
  subaccountId: string;
  allocatedMcu: number;
  periodStart?: string;
  periodEnd?: string;
}

export interface DeductMcuInput {
  subaccountId: string;
  amount: number;
  videoId?: string;
  reason?: string;
}

export interface CreateReviewLinkInput {
  subaccountId: string;
  videoId: string;
  videoTitle?: string;
  videoUrl?: string;
  ttlMs?: number;
  baseUrl?: string;
}

export interface SubmitReviewFeedbackInput {
  token: string;
  comment: string;
  author?: string;
  timestampSec?: number;
}

export interface SubmitReviewDecisionInput {
  token: string;
  decision: 'approve' | 'request_changes';
  feedbackNote?: string;
  author?: string;
}

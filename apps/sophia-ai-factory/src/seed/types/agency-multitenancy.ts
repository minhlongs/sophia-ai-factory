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

export type {
  ReviewStatus,
  FeedbackComment,
  VideoReviewPayload,
  VideoReviewRecord,
  CreateSubaccountInput,
  UpdateSubaccountInput,
  UpdateBrandingInput,
  AllocateMcuInput,
  DeductMcuInput,
  CreateReviewLinkInput,
  SubmitReviewFeedbackInput,
  SubmitReviewDecisionInput,
} from './agency-multitenancy-inputs';

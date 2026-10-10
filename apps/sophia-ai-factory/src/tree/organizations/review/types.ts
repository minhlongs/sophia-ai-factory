/**
 * Video Review & Approval Domain Types and Database Interfaces.
 *
 * Layer: tree/organizations/review
 * Allowed imports: @/seed/*
 */

export type {
  VideoReviewPayload,
  CreateReviewLinkInput,
  SubmitReviewFeedbackInput,
  SubmitReviewDecisionInput,
  FeedbackComment,
} from '@/seed/types/agency-multitenancy';

export interface ReviewDbRow {
  id: string;
  subaccount_id: string;
  video_id: string;
  video_title: string | null;
  video_url: string | null;
  token_hash: string;
  status: string;
  feedback_comments: string;
  reviewed_at: string | null;
  created_at: string;
  expires_at: string;
  client_name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
}

export interface AutoPublishHookParams {
  subaccountId: string;
  videoId: string;
  videoTitle?: string;
}

export interface AutoPublishHookResult {
  dispatched: boolean;
  channel?: string;
  message?: string;
}

export interface ReviewDecisionResult {
  success: boolean;
  status: 'APPROVED' | 'CHANGES_REQUESTED';
  autoPublishTriggered: boolean;
  alreadyApproved?: boolean;
  triggerResult?: AutoPublishHookResult;
}

export interface CreateReviewLinkResult {
  reviewId: string;
  rawToken: string;
  reviewUrl: string;
  expiresAt: string;
}

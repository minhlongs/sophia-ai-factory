/**
 * Interactive Client Video Review & Approval Domain Service
 *
 * Implements:
 * - Cryptographic review token generation with SHA-256 hash storage
 * - Token verification & subaccount branding resolution
 * - Timestamped feedback submission
 * - Decision processing re-exported from decision-processor
 *
 * Layer: tree/organizations/review
 * Allowed imports: @/seed/*, @/tree/organizations/review/*
 */

import type { D1Database } from '@/seed/db/client';
import {
  generateReviewToken,
  sha256Hex,
  timingSafeEqual,
} from '@/seed/security/review-token';
import type {
  VideoReviewPayload,
  CreateReviewLinkInput,
  SubmitReviewFeedbackInput,
  FeedbackComment,
} from '@/seed/types/agency-multitenancy';
import type {
  ReviewDbRow,
  CreateReviewLinkResult,
} from './types';
import {
  validateTokenInput,
  parseFeedbackComments,
  normalizeReviewStatus,
  checkIsExpired,
} from './criteria-evaluator';

export { submitReviewDecision } from './decision-processor';

/**
 * Creates a secure, tokenized review link for a video draft.
 */
export async function createVideoReviewLink(
  db: D1Database,
  input: CreateReviewLinkInput
): Promise<CreateReviewLinkResult> {
  const subaccountId = input.subaccountId?.trim();
  const videoId = input.videoId?.trim();

  if (!subaccountId) {
    throw new Error('VALIDATION_ERROR: subaccountId is required');
  }
  if (!videoId) {
    throw new Error('VALIDATION_ERROR: videoId is required');
  }

  const { rawToken, tokenHash, expiresAt } = await generateReviewToken(input.ttlMs);
  const id = `rev_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();
  const title = input.videoTitle?.trim() || 'Untitled Video Draft';
  const videoUrl = input.videoUrl?.trim() || '';

  await db
    .prepare(`
      INSERT INTO video_reviews (
        id, subaccount_id, video_id, video_title, video_url, token_hash, status, feedback_comments, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', '[]', ?, ?)
    `)
    .bind(id, subaccountId, videoId, title, videoUrl, tokenHash, now, expiresAt)
    .run();

  const baseUrl = input.baseUrl ? input.baseUrl.replace(/\/$/, '') : '';
  const reviewUrl = `${baseUrl}/client-review/${rawToken}`;

  return {
    reviewId: id,
    rawToken,
    reviewUrl,
    expiresAt,
  };
}

/**
 * Resolves a video review payload by raw token, validating its hash, status, and client branding.
 */
export async function resolveReviewByToken(
  db: D1Database,
  rawToken: string
): Promise<VideoReviewPayload> {
  const trimmedToken = validateTokenInput(rawToken);
  const tokenHash = await sha256Hex(trimmedToken);

  const row = await db
    .prepare(`
      SELECT
        vr.id, vr.subaccount_id, vr.video_id, vr.video_title, vr.video_url,
        vr.token_hash, vr.status, vr.feedback_comments, vr.reviewed_at, vr.created_at, vr.expires_at,
        cs.name as client_name,
        sb.logo_url, sb.primary_color, sb.accent_color
      FROM video_reviews vr
      LEFT JOIN client_subaccounts cs ON vr.subaccount_id = cs.id
      LEFT JOIN subaccount_branding sb ON vr.subaccount_id = sb.subaccount_id
      WHERE vr.token_hash = ?
    `)
    .bind(tokenHash)
    .first<ReviewDbRow>();

  if (!row || !timingSafeEqual(row.token_hash, tokenHash)) {
    throw new Error('REVIEW_NOT_FOUND: Invalid or non-existent review token');
  }

  const isExpired = checkIsExpired(row.expires_at);
  const feedbackComments = parseFeedbackComments(row.feedback_comments);
  const status = normalizeReviewStatus(row.status);

  return {
    token: rawToken,
    subaccountId: row.subaccount_id,
    videoId: row.video_id,
    videoTitle: row.video_title || 'Video Draft',
    videoUrl: row.video_url || '',
    status,
    feedbackComments,
    subaccountBranding: {
      clientName: row.client_name ?? undefined,
      logoUrl: row.logo_url ?? undefined,
      primaryColor: row.primary_color ?? '#0f172a',
      accentColor: row.accent_color ?? '#10b981',
    },
    expiresAt: row.expires_at,
    isExpired,
  };
}

/**
 * Appends a feedback comment (optionally pinned to video timestamp) to the review record.
 */
export async function addReviewFeedback(
  db: D1Database,
  input: SubmitReviewFeedbackInput
): Promise<FeedbackComment[]> {
  const { token, comment, author, timestampSec } = input;
  const trimmedToken = validateTokenInput(token);

  if (!comment?.trim()) {
    throw new Error('VALIDATION_ERROR: Comment cannot be empty');
  }

  const tokenHash = await sha256Hex(trimmedToken);

  const row = await db
    .prepare('SELECT id, feedback_comments, expires_at, status, token_hash FROM video_reviews WHERE token_hash = ?')
    .bind(tokenHash)
    .first<{ id: string; feedback_comments: string; expires_at: string; status: string; token_hash: string }>();

  if (!row || !timingSafeEqual(row.token_hash, tokenHash)) {
    throw new Error('REVIEW_NOT_FOUND: Cannot add feedback to invalid review token');
  }

  if (checkIsExpired(row.expires_at)) {
    throw new Error('REVIEW_EXPIRED: Cannot add feedback to an expired review token');
  }

  const comments = parseFeedbackComments(row.feedback_comments);

  const newComment: FeedbackComment = {
    author: author?.trim() || 'Client Reviewer',
    comment: comment.trim(),
    timestampSec: typeof timestampSec === 'number' && timestampSec >= 0 ? Math.floor(timestampSec) : undefined,
    createdAt: new Date().toISOString(),
  };

  comments.push(newComment);

  await db
    .prepare('UPDATE video_reviews SET feedback_comments = ? WHERE id = ?')
    .bind(JSON.stringify(comments), row.id)
    .run();

  return comments;
}

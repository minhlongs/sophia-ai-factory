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
import { generateReviewToken } from '@/seed/security/review-token';
import type { CreateReviewLinkInput } from '@/seed/types/agency-multitenancy';
import type { CreateReviewLinkResult } from './types';
import {
  addReviewFeedback,
  resolveReviewByToken,
} from './review-service-helpers';

export { submitReviewDecision } from './decision-processor';
export { addReviewFeedback, resolveReviewByToken };

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

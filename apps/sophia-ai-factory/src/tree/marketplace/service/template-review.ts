/**
 * Creator Marketplace Template Review Mutator
 *
 * Layer: tree/marketplace
 *
 * @module tree/marketplace/service/template-review
 */

import type { D1Database } from '@/seed/db/client';
import type { SubmitReviewInput, SubmitReviewResult } from '../types';

/**
 * Submits a template review and incrementally updates the template's average rating.
 *
 * Incremental rating update:
 * R_new = (R_old * C_old + R_user) / (C_old + 1)
 * C_new = C_old + 1
 */
export async function submitTemplateReview(
  db: D1Database,
  input: SubmitReviewInput,
  nowMs = Date.now(),
): Promise<SubmitReviewResult> {
  // 1. Validate rating range [1.0, 5.0]
  if (typeof input.rating !== 'number' || input.rating < 1.0 || input.rating > 5.0) {
    throw new Error('INVALID_RATING: Rating must be a number between 1.0 and 5.0.');
  }

  // 2. Verify template exists
  const template = await db
    .prepare('SELECT id, rating, review_count FROM creator_templates WHERE id = ? LIMIT 1')
    .bind(input.templateId)
    .first<{ id: string; rating?: number; review_count?: number }>();

  if (!template) {
    throw new Error(`TEMPLATE_NOT_FOUND: Template with ID '${input.templateId}' does not exist.`);
  }

  // 3. Check for existing review (enforcing UNIQUE(template_id, user_id))
  const existingReview = await db
    .prepare('SELECT id, rating FROM creator_reviews WHERE template_id = ? AND user_id = ? LIMIT 1')
    .bind(input.templateId, input.userId)
    .first<{ id: string; rating: number }>();

  if (existingReview) {
    throw new Error('DUPLICATE_REVIEW_PROHIBITED: You have already submitted a review for this template.');
  }

  const reviewId = `rev_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}_${nowMs}`;

  // 4. Insert review into creator_reviews
  await db
    .prepare(
      `INSERT INTO creator_reviews (
        id, template_id, user_id, tenant_id, rating, review_text, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      reviewId,
      input.templateId,
      input.userId,
      input.tenantId,
      input.rating,
      input.reviewText ?? null,
      nowMs,
      nowMs,
    )
    .run();

  // 5. Compute incremental rating update
  const oldRating = template.rating ?? 0.0;
  const oldCount = template.review_count ?? 0;

  const newCount = oldCount + 1;
  const rawNewRating = (oldRating * oldCount + input.rating) / newCount;
  const newRating = Math.round(rawNewRating * 100) / 100;

  // 6. Update template record
  await db
    .prepare(
      `UPDATE creator_templates
       SET rating = ?, review_count = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(newRating, newCount, nowMs, input.templateId)
    .run();

  return {
    success: true,
    reviewId,
    newRating,
    newReviewCount: newCount,
  };
}

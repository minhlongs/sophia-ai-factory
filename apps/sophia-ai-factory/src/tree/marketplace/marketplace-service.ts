/**
 * Creator Marketplace Discovery, Template Management & Review Service
 *
 * Layer: tree (domain algorithms, database operations, rating accruals)
 * Dependencies: @/seed/db/client, @/seed/utils/logger-utility, ./types, ./quality-scorer, ./royalty-engine
 *
 * Implements:
 * 1. Trending rank decay algorithm:
 *    trendingScore = (useCount * 3.0 + rating * reviewCount * 2.0) / Math.pow(hoursSinceCreated + 2.0, 1.3)
 * 2. Catalog querying with multi-faceted filtering & search
 * 3. AI Quality Scorer auto-approval on submission
 * 4. Incremental Bayesian/Moving average review accrual:
 *    R_new = (R_old * C_old + R_user) / (C_old + 1)
 * 5. Template activation lifecycle with royalty ledger distribution
 *
 * @module tree/marketplace/marketplace-service
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  CreatorTemplate,
  CreatorTemplateItem,
  CreatorReview,
  TemplateQueryFilter,
  PaginatedTemplates,
  CreateTemplateInput,
  SubmitReviewInput,
  SubmitReviewResult,
  RoyaltyAccrualResult,
} from './types';
import { scoreTemplateQuality } from './quality-scorer';
import { accrueRoyalty } from './royalty-engine';

/**
 * Calculates trending rank score with engagement velocity and time decay.
 *
 * Invariant:
 * Adding 2.0 hours to the denominator ensures well-behaved bounded values
 * at t = 0 and prevents division by zero.
 */
export function calculateTrendingRank(
  useCount: number,
  rating: number,
  reviewCount: number,
  createdAtMs: number,
  nowMs = Date.now(),
): number {
  const hoursSinceCreated = Math.max(0, (nowMs - createdAtMs) / (1000 * 60 * 60));
  const numerator = useCount * 3.0 + rating * reviewCount * 2.0;
  const denominator = Math.pow(hoursSinceCreated + 2.0, 1.3);

  const rawScore = numerator / denominator;
  return Math.round(rawScore * 1000) / 1000;
}

/**
 * Lists creator templates with filtering, search, and dynamic sorting (including trending decay).
 */
export async function listMarketplaceTemplates(
  db: D1Database | null,
  filter?: TemplateQueryFilter,
  nowMs = Date.now(),
): Promise<PaginatedTemplates> {
  const page = Math.max(1, filter?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter?.pageSize ?? 12));

  if (!db) {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 1,
    };
  }

  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: unknown[] = [];

  // Filter: status (default to 'approved' for public marketplace browsing)
  if (filter?.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  } else {
    conditions.push("status = 'approved'");
  }

  // Filter: niche
  if (filter?.niche && filter.niche !== 'all') {
    conditions.push('niche = ?');
    params.push(filter.niche);
  }

  // Filter: platform
  if (filter?.targetPlatform && filter.targetPlatform !== 'all') {
    conditions.push('target_platform = ?');
    params.push(filter.targetPlatform);
  }

  // Filter: price range
  if (filter?.minPriceCents !== undefined) {
    conditions.push('price_cents >= ?');
    params.push(filter.minPriceCents);
  }
  if (filter?.maxPriceCents !== undefined) {
    conditions.push('price_cents <= ?');
    params.push(filter.maxPriceCents);
  }

  // Filter: search text
  if (filter?.search && filter.search.trim().length > 0) {
    const term = `%${filter.search.trim()}%`;
    conditions.push('(title LIKE ? OR description LIKE ? OR niche LIKE ?)');
    params.push(term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching
  let total = 0;
  try {
    const countRow = await db
      .prepare(`SELECT COUNT(*) AS total FROM creator_templates ${whereClause}`)
      .bind(...params)
      .first<{ total: number }>();
    total = countRow?.total ?? 0;
  } catch (err) {
    logger.warn('[marketplace-service] Count query error, fallback to 0', { error: String(err) });
  }

  // Determine SQL order if sorting in database
  const sortBy = filter?.sortBy ?? 'trending';
  let sqlOrderBy = 'created_at DESC';

  if (sortBy === 'top_rated') {
    sqlOrderBy = 'rating DESC, review_count DESC';
  } else if (sortBy === 'most_used') {
    sqlOrderBy = 'use_count DESC, rating DESC';
  } else if (sortBy === 'newest') {
    sqlOrderBy = 'created_at DESC';
  } else if (sortBy === 'price_asc') {
    sqlOrderBy = 'price_cents ASC';
  } else if (sortBy === 'price_desc') {
    sqlOrderBy = 'price_cents DESC';
  }

  // If sorting by trending, we fetch matching candidates, annotate with trending score, and sort
  const queryLimit = sortBy === 'trending' ? Math.max(100, page * pageSize) : pageSize;
  const queryOffset = sortBy === 'trending' ? 0 : offset;

  let rows: CreatorTemplate[] = [];
  try {
    const res = await db
      .prepare(
        `SELECT * FROM creator_templates 
         ${whereClause} 
         ORDER BY ${sqlOrderBy} 
         LIMIT ? OFFSET ?`,
      )
      .bind(...params, queryLimit, queryOffset)
      .all<CreatorTemplate>();
    rows = (res.results as CreatorTemplate[]) || [];
  } catch (err) {
    logger.warn('[marketplace-service] Query creator_templates error', { error: String(err) });
  }

  // Augment items with trending score
  const itemsWithTrending: CreatorTemplateItem[] = rows.map((row) => ({
    ...row,
    trendingScore: calculateTrendingRank(
      row.use_count ?? 0,
      row.rating ?? 0,
      row.review_count ?? 0,
      row.created_at ?? nowMs,
      nowMs,
    ),
  }));

  let finalItems: CreatorTemplateItem[];
  if (sortBy === 'trending') {
    itemsWithTrending.sort((a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0));
    finalItems = itemsWithTrending.slice(offset, offset + pageSize);
  } else {
    finalItems = itemsWithTrending;
  }

  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    items: finalItems,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Retrieves a single template by ID along with its verified community reviews.
 */
export async function getMarketplaceTemplateById(
  db: D1Database | null,
  templateId: string,
): Promise<{ template: CreatorTemplateItem | null; reviews: CreatorReview[] }> {
  if (!db) {
    return { template: null, reviews: [] };
  }
  try {
    const template = await db
      .prepare('SELECT * FROM creator_templates WHERE id = ? LIMIT 1')
      .bind(templateId)
      .first<CreatorTemplate>();

    if (!template) {
      return { template: null, reviews: [] };
    }

    const reviewsRes = await db
      .prepare('SELECT * FROM creator_reviews WHERE template_id = ? ORDER BY created_at DESC LIMIT 50')
      .bind(templateId)
      .all<CreatorReview>();

    const item: CreatorTemplateItem = {
      ...template,
      trendingScore: calculateTrendingRank(
        template.use_count ?? 0,
        template.rating ?? 0,
        template.review_count ?? 0,
        template.created_at ?? Date.now(),
      ),
    };

    return {
      template: item,
      reviews: (reviewsRes.results as CreatorReview[]) || [],
    };
  } catch (err) {
    logger.warn('[marketplace-service] getMarketplaceTemplateById error', { templateId, error: String(err) });
    return { template: null, reviews: [] };
  }
}

/**
 * Creates and evaluates a creator template with the AI Quality Scorer.
 * Automatically approves templates scoring >= 75.
 */
export async function createMarketplaceTemplate(
  db: D1Database,
  input: CreateTemplateInput,
  nowMs = Date.now(),
): Promise<{ template: CreatorTemplate; qualityResult: ReturnType<typeof scoreTemplateQuality> }> {
  // 1. Evaluate template virality quality
  const quality = scoreTemplateQuality({
    title: input.title,
    scriptTemplate: input.scriptTemplate,
    hookStyle: input.hookStyle,
    storyboardJson: input.storyboardJson,
    aspectRatio: input.aspectRatio,
    niche: input.niche,
    targetPlatform: input.targetPlatform,
    visualStylePrompt: input.visualStylePrompt,
  });

  const templateId = `tpl_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}_${nowMs}`;
  const priceCents = input.priceCents ?? 0;
  const status = quality.status; // 'approved' | 'pending' | 'rejected'
  const feedbackStr = quality.feedback.join('; ');

  const templateRecord: CreatorTemplate = {
    id: templateId,
    creator_id: input.creatorId,
    tenant_id: input.tenantId,
    title: input.title,
    description: input.description ?? null,
    niche: input.niche ?? 'general',
    target_platform: input.targetPlatform ?? 'tiktok',
    aspect_ratio: input.aspectRatio ?? '9:16',
    hook_style: input.hookStyle ?? 'curiosity_gap',
    script_template: input.scriptTemplate,
    storyboard_json: input.storyboardJson ?? '[]',
    visual_style_prompt: input.visualStylePrompt,
    music_prompt: input.musicPrompt ?? null,
    voice_profile: input.voiceProfile ?? null,
    price_cents: priceCents,
    royalty_pct: 70.0,
    status,
    quality_score: quality.totalScore,
    review_feedback: feedbackStr || null,
    use_count: 0,
    rating: 0.0,
    review_count: 0,
    created_at: nowMs,
    updated_at: nowMs,
  };

  // 2. Persist to D1
  await db
    .prepare(
      `INSERT INTO creator_templates (
        id, creator_id, tenant_id, title, description, niche, target_platform,
        aspect_ratio, hook_style, script_template, storyboard_json,
        visual_style_prompt, music_prompt, voice_profile, price_cents,
        royalty_pct, status, quality_score, review_feedback, use_count,
        rating, review_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      templateRecord.id,
      templateRecord.creator_id,
      templateRecord.tenant_id,
      templateRecord.title,
      templateRecord.description,
      templateRecord.niche,
      templateRecord.target_platform,
      templateRecord.aspect_ratio,
      templateRecord.hook_style,
      templateRecord.script_template,
      templateRecord.storyboard_json,
      templateRecord.visual_style_prompt,
      templateRecord.music_prompt,
      templateRecord.voice_profile,
      templateRecord.price_cents,
      templateRecord.royalty_pct,
      templateRecord.status,
      templateRecord.quality_score,
      templateRecord.review_feedback,
      templateRecord.use_count,
      templateRecord.rating,
      templateRecord.review_count,
      templateRecord.created_at,
      templateRecord.updated_at,
    )
    .run();

  return {
    template: templateRecord,
    qualityResult: quality,
  };
}

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

/**
 * Activates a creator template with 70/30 royalty smart ledger disbursement.
 */
export async function activateMarketplaceTemplate(
  db: D1Database,
  input: {
    templateId: string;
    activatingUserId: string;
    tenantId: string;
    videoJobId?: string;
    nowMs?: number;
  },
): Promise<{
  success: boolean;
  activationResult: RoyaltyAccrualResult;
  template: CreatorTemplate;
}> {
  const nowMs = input.nowMs ?? Date.now();

  // 1. Fetch template
  const template = await db
    .prepare('SELECT * FROM creator_templates WHERE id = ? LIMIT 1')
    .bind(input.templateId)
    .first<CreatorTemplate>();

  if (!template) {
    throw new Error(`TEMPLATE_NOT_FOUND: Template '${input.templateId}' does not exist.`);
  }

  if (template.status !== 'approved') {
    throw new Error(`TEMPLATE_NOT_ACTIVE: Template status is '${template.status}', must be 'approved'.`);
  }

  // 2. Accrue royalty (enforces anti-self-activation & 70/30 OCC CAS ledger)
  const activationResult = await accrueRoyalty({
    db,
    templateId: template.id,
    creatorId: template.creator_id,
    activatingUserId: input.activatingUserId,
    tenantId: input.tenantId,
    priceCents: template.price_cents,
    royaltyPct: template.royalty_pct,
    videoJobId: input.videoJobId,
    nowMs,
  });

  // 3. Increment template usage
  try {
    await db
      .prepare('UPDATE creator_templates SET use_count = use_count + 1, updated_at = ? WHERE id = ?')
      .bind(nowMs, template.id)
      .run();
  } catch (err) {
    logger.warn('[marketplace-service] Failed to update template use_count', { error: String(err) });
  }

  return {
    success: true,
    activationResult,
    template: {
      ...template,
      use_count: template.use_count + 1,
    },
  };
}

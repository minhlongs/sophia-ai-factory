/**
 * Creator Studio Management & Analytics Service
 *
 * Layer: land (user-facing operations, D1 database mutations, and aggregates)
 * Dependencies: @/seed/types/creator-marketplace, @/seed/utils/logger-utility, @/tree/creator-royalties/template-activation
 *
 * @module land/creator/creator-studio-service
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  CreatorTemplate,
  CreateTemplateInput,
  CreatorStudioStats,
  TemplateStatus,
  PayoutRail,
} from '@/seed/types/creator-marketplace';
import {
  CreateTemplateInputSchema,
} from '@/seed/types/creator-marketplace';

export interface CreatorProfileData {
  id: string;
  userId: string;
  displayName: string;
  payoutRail: PayoutRail;
  payoutAddress?: string | null;
  bankBin?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  totalEarningsCents: number;
  totalPaidCents: number;
  status: string;
}

interface TemplateDbRow {
  id: string;
  creator_id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  niche: string;
  target_platform: string;
  aspect_ratio: string;
  hook_style: string;
  script_template: string;
  storyboard_json: string;
  visual_style_prompt: string;
  music_prompt: string | null;
  voice_profile: string | null;
  price_cents: number;
  royalty_pct: number;
  status: string;
  quality_score: number | null;
  review_feedback: string | null;
  use_count: number;
  rating: number;
  review_count: number;
  created_at: number;
  updated_at: number;
}

function mapTemplateRow(row: TemplateDbRow): CreatorTemplate {
  return {
    id: row.id,
    creatorId: row.creator_id,
    tenantId: row.tenant_id,
    title: row.title,
    description: row.description,
    niche: row.niche,
    targetPlatform: row.target_platform as CreatorTemplate['targetPlatform'],
    aspectRatio: row.aspect_ratio as CreatorTemplate['aspectRatio'],
    hookStyle: row.hook_style,
    scriptTemplate: row.script_template,
    storyboardJson: row.storyboard_json || '[]',
    visualStylePrompt: row.visual_style_prompt,
    musicPrompt: row.music_prompt,
    voiceProfile: row.voice_profile,
    priceCents: row.price_cents,
    royaltyPct: row.royalty_pct,
    status: row.status as TemplateStatus,
    qualityScore: row.quality_score ?? 0,
    reviewFeedback: row.review_feedback,
    useCount: row.use_count,
    rating: row.rating,
    reviewCount: row.review_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetch aggregated statistics for a creator in Creator Studio.
 */
export async function getCreatorStudioStats(
  db: D1Database,
  creatorId: string,
): Promise<CreatorStudioStats> {
  let totalTemplates = 0;
  let totalUses = 0;
  let totalReviews = 0;
  let weightedRatingSum = 0;

  // 1. Template metrics
  try {
    const templateMetrics = await db
      .prepare(
        `SELECT 
           COUNT(*) as total_templates,
           COALESCE(SUM(use_count), 0) as total_uses,
           COALESCE(SUM(review_count), 0) as total_reviews,
           COALESCE(SUM(rating * review_count), 0) as rating_sum
         FROM creator_templates
         WHERE creator_id = ? AND status != 'archived'`,
      )
      .bind(creatorId)
      .first<{
        total_templates?: number;
        total_uses?: number;
        total_reviews?: number;
        rating_sum?: number;
      }>();

    if (templateMetrics) {
      totalTemplates = templateMetrics.total_templates ?? 0;
      totalUses = templateMetrics.total_uses ?? 0;
      totalReviews = templateMetrics.total_reviews ?? 0;
      weightedRatingSum = templateMetrics.rating_sum ?? 0;
    }
  } catch (err) {
    logger.warn('Failed to query template metrics for studio stats', { creatorId, error: String(err) });
  }

  const averageRating = totalReviews > 0 ? Math.round((weightedRatingSum / totalReviews) * 10) / 10 : 0.0;

  // 2. Financial ledger & profile metrics
  let totalEarningsCents = 0;
  let totalPaidCents = 0;
  let pendingBalanceCents = 0;

  try {
    const profile = await db
      .prepare(
        `SELECT total_earnings_cents, total_paid_cents 
         FROM creator_profiles 
         WHERE id = ? OR user_id = ?
         LIMIT 1`,
      )
      .bind(creatorId, creatorId)
      .first<{ total_earnings_cents?: number; total_paid_cents?: number }>();

    if (profile) {
      totalEarningsCents = profile.total_earnings_cents ?? 0;
      totalPaidCents = profile.total_paid_cents ?? 0;
    }
  } catch (err) {
    logger.warn('Failed to query creator profile for earnings', { creatorId, error: String(err) });
  }

  try {
    const ledgerPending = await db
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) as pending_sum
         FROM creator_earnings_ledger
         WHERE creator_id = ? AND status = 'pending' AND event_type = 'royalty_accrual'`,
      )
      .bind(creatorId)
      .first<{ pending_sum?: number }>();

    if (ledgerPending) {
      pendingBalanceCents = ledgerPending.pending_sum ?? 0;
    }
  } catch {
    // Graceful fallback if ledger not queried
  }

  const creatorRoyaltyCents = totalEarningsCents;
  // Based on 70/30 protocol: gross = creatorRoyalty / 0.70
  const grossEarningsCents = creatorRoyaltyCents > 0
    ? Math.round(creatorRoyaltyCents / 0.7)
    : 0;
  const platformFeesCents = Math.max(0, grossEarningsCents - creatorRoyaltyCents);
  const availableBalanceCents = Math.max(0, totalEarningsCents - totalPaidCents);

  return {
    totalTemplates,
    totalUses,
    grossEarningsCents,
    creatorRoyaltyCents,
    platformFeesCents,
    availableBalanceCents,
    pendingBalanceCents,
    averageRating,
    totalReviews,
  };
}

/**
 * List templates for a creator with pagination and filtering.
 */
export async function listCreatorTemplates(
  db: D1Database,
  creatorId: string,
  options?: { status?: TemplateStatus; limit?: number; offset?: number },
): Promise<{ items: CreatorTemplate[]; total: number }> {
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);

  let countSql = `SELECT COUNT(*) as cnt FROM creator_templates WHERE creator_id = ?`;
  let selectSql = `SELECT * FROM creator_templates WHERE creator_id = ?`;
  const binds: unknown[] = [creatorId];

  if (options?.status) {
    countSql += ` AND status = ?`;
    selectSql += ` AND status = ?`;
    binds.push(options.status);
  } else {
    countSql += ` AND status != 'archived'`;
    selectSql += ` AND status != 'archived'`;
  }

  selectSql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;

  let total = 0;
  try {
    const countRow = await db.prepare(countSql).bind(...binds).first<{ cnt?: number }>();
    total = countRow?.cnt ?? 0;
  } catch (err) {
    logger.warn('Failed to count creator templates', { creatorId, error: String(err) });
  }

  const selectBinds = [...binds, limit, offset];
  try {
    const rows = await db.prepare(selectSql).bind(...selectBinds).all<TemplateDbRow>();
    const items = (rows.results ?? []).map(mapTemplateRow);
    return { items, total };
  } catch (err) {
    logger.error('Failed to list creator templates', { creatorId, error: String(err) });
    return { items: [], total: 0 };
  }
}

/**
 * Create a new creator template.
 */
export async function createCreatorTemplate(
  db: D1Database,
  creatorId: string,
  tenantId: string,
  rawInput: CreateTemplateInput,
  nowMs = Date.now(),
): Promise<{ success: boolean; template?: CreatorTemplate; error?: string }> {
  const parseResult = CreateTemplateInputSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((e) => e.message).join('; '),
    };
  }

  const input = parseResult.data;
  const id = `tmpl_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const royaltyPct = 70.0;
  const status: TemplateStatus = 'pending';

  try {
    await db
      .prepare(
        `INSERT INTO creator_templates (
          id, creator_id, tenant_id, title, description, niche, target_platform,
          aspect_ratio, hook_style, script_template, storyboard_json, visual_style_prompt,
          music_prompt, voice_profile, price_cents, royalty_pct, status,
          quality_score, use_count, rating, review_count, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )`,
      )
      .bind(
        id,
        creatorId,
        tenantId,
        input.title,
        input.description ?? null,
        input.niche,
        input.targetPlatform,
        input.aspectRatio,
        input.hookStyle,
        input.scriptTemplate,
        input.storyboardJson ?? '[]',
        input.visualStylePrompt,
        input.musicPrompt ?? null,
        input.voiceProfile ?? null,
        input.priceCents,
        royaltyPct,
        status,
        0.0,
        0,
        0.0,
        0,
        nowMs,
        nowMs,
      )
      .run();

    const created: CreatorTemplate = {
      id,
      creatorId,
      tenantId,
      title: input.title,
      description: input.description ?? null,
      niche: input.niche,
      targetPlatform: input.targetPlatform,
      aspectRatio: input.aspectRatio,
      hookStyle: input.hookStyle,
      scriptTemplate: input.scriptTemplate,
      storyboardJson: input.storyboardJson ?? '[]',
      visualStylePrompt: input.visualStylePrompt,
      musicPrompt: input.musicPrompt ?? null,
      voiceProfile: input.voiceProfile ?? null,
      priceCents: input.priceCents,
      royaltyPct,
      status,
      qualityScore: 0,
      reviewFeedback: null,
      useCount: 0,
      rating: 0,
      reviewCount: 0,
      createdAt: nowMs,
      updatedAt: nowMs,
    };

    logger.info('Creator template created successfully', { templateId: id, creatorId });
    return { success: true, template: created };
  } catch (err) {
    logger.error('Failed to create creator template', { creatorId, error: String(err) });
    return { success: false, error: err instanceof Error ? err.message : 'INSERT_FAILED' };
  }
}

/**
 * Archive / delete a creator template.
 */
export async function archiveCreatorTemplate(
  db: D1Database,
  templateId: string,
  creatorId: string,
  nowMs = Date.now(),
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await db
      .prepare(
        `UPDATE creator_templates 
         SET status = 'archived', updated_at = ? 
         WHERE id = ? AND creator_id = ?`,
      )
      .bind(nowMs, templateId, creatorId)
      .run();

    if (res.meta && res.meta.changes === 0) {
      return { success: false, error: 'TEMPLATE_NOT_FOUND_OR_UNAUTHORIZED' };
    }

    return { success: true };
  } catch (err) {
    logger.error('Failed to archive creator template', { templateId, error: String(err) });
    return { success: false, error: err instanceof Error ? err.message : 'ARCHIVE_FAILED' };
  }
}

/**
 * Fetch creator profile details including payout rail and banking configuration.
 */
export async function getCreatorProfile(
  db: D1Database,
  creatorIdOrUserId: string,
): Promise<CreatorProfileData | null> {
  try {
    const row = await db
      .prepare(
        `SELECT id, user_id, display_name, payout_rail, payout_address,
                bank_bin, bank_account_number, bank_account_name,
                total_earnings_cents, total_paid_cents, status
         FROM creator_profiles 
         WHERE id = ? OR user_id = ?
         LIMIT 1`,
      )
      .bind(creatorIdOrUserId, creatorIdOrUserId)
      .first<{
        id: string;
        user_id: string;
        display_name: string;
        payout_rail?: string | null;
        payout_address?: string | null;
        bank_bin?: string | null;
        bank_account_number?: string | null;
        bank_account_name?: string | null;
        total_earnings_cents?: number;
        total_paid_cents?: number;
        status: string;
      }>();

    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      payoutRail: (row.payout_rail as PayoutRail) ?? 'USDT',
      payoutAddress: row.payout_address,
      bankBin: row.bank_bin,
      bankAccountNumber: row.bank_account_number,
      bankAccountName: row.bank_account_name,
      totalEarningsCents: row.total_earnings_cents ?? 0,
      totalPaidCents: row.total_paid_cents ?? 0,
      status: row.status,
    };
  } catch (err) {
    logger.warn('Failed to fetch creator profile', { identifier: creatorIdOrUserId, error: String(err) });
    return null;
  }
}

/**
 * Update payout preferences (USDT or VietQR) on creator_profiles.
 */
export async function updateCreatorPayoutSettings(
  db: D1Database,
  creatorId: string,
  config: {
    payoutRail: PayoutRail;
    payoutAddress?: string;
    bankBin?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
  },
  nowMs = Date.now(),
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .prepare(
        `UPDATE creator_profiles 
         SET payout_rail = ?,
             payout_address = ?,
             bank_bin = ?,
             bank_account_number = ?,
             bank_account_name = ?,
             updated_at = ?
         WHERE id = ? OR user_id = ?`,
      )
      .bind(
        config.payoutRail,
        config.payoutAddress ?? null,
        config.bankBin ?? null,
        config.bankAccountNumber ?? null,
        config.bankAccountName ?? null,
        nowMs,
        creatorId,
        creatorId,
      )
      .run();

    return { success: true };
  } catch (err) {
    logger.error('Failed to update creator payout settings', { creatorId, error: String(err) });
    return { success: false, error: err instanceof Error ? err.message : 'UPDATE_FAILED' };
  }
}

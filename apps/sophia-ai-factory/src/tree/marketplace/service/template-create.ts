/**
 * Creator Marketplace Template Creation
 *
 * Layer: tree/marketplace
 *
 * @module tree/marketplace/service/template-create
 */

import type { D1Database } from '@/seed/db/client';
import type { CreatorTemplate, CreateTemplateInput } from '../types';
import { scoreTemplateQuality } from '../quality-scorer';

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

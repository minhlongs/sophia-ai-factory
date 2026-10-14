/**
 * SQL insert and entity construction helpers for creator templates.
 * @module land/creator/studio/template-manager-helpers
 */

import type {
  CreatorTemplate,
  CreateTemplateInput,
  TemplateStatus,
} from '@/seed/types/creator-marketplace';

export async function insertCreatorTemplateRecord(params: {
  db: D1Database;
  id: string;
  creatorId: string;
  tenantId: string;
  input: CreateTemplateInput;
  royaltyPct: number;
  status: TemplateStatus;
  nowMs: number;
}): Promise<CreatorTemplate> {
  const { db, id, creatorId, tenantId, input, royaltyPct, status, nowMs } = params;

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

  return {
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
}

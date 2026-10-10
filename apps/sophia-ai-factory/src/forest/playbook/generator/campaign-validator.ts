import type { D1Database } from '@/seed/db/client';
import type { CampaignBlueprint } from '@/seed/types/playbook-pattern';
import { createServerClient, getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Persist a synthesized blueprint into the campaign_blueprints D1 table.
 */
export async function saveCampaignBlueprint(
  blueprint: CampaignBlueprint,
  dbOverride?: D1Database,
): Promise<boolean> {
  try {
    const d1 = dbOverride ?? (await getD1());
    if (!d1) {
      const db = createServerClient();
      const { error } = await db.from('campaign_blueprints').insert({
        id: blueprint.id,
        workspace_id: blueprint.workspaceId,
        name_en: blueprint.name.en,
        name_vi: blueprint.name.vi,
        description_en: blueprint.description.en,
        description_vi: blueprint.description.vi,
        target_platform: blueprint.targetPlatform,
        hook_style: blueprint.hookStyle,
        voice_style: blueprint.voiceStyle,
        duration_seconds: blueprint.durationSeconds,
        aspect_ratio: blueprint.aspectRatio,
        estimated_scenes: blueprint.estimatedScenes,
        suggested_prompts: JSON.stringify(blueprint.suggestedPrompts),
        is_active: blueprint.isActive ? 1 : 0,
        created_at: blueprint.createdAt,
        updated_at: blueprint.updatedAt,
      });
      return !error;
    }

    const stmt = d1.prepare(
      `INSERT INTO campaign_blueprints
       (id, workspace_id, name_en, name_vi, description_en, description_vi,
        target_platform, hook_style, voice_style, duration_seconds, aspect_ratio,
        estimated_scenes, suggested_prompts, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        name_en = excluded.name_en,
        name_vi = excluded.name_vi,
        description_en = excluded.description_en,
        description_vi = excluded.description_vi,
        target_platform = excluded.target_platform,
        hook_style = excluded.hook_style,
        voice_style = excluded.voice_style,
        duration_seconds = excluded.duration_seconds,
        aspect_ratio = excluded.aspect_ratio,
        estimated_scenes = excluded.estimated_scenes,
        suggested_prompts = excluded.suggested_prompts,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at`,
    );

    const res = await stmt
      .bind(
        blueprint.id,
        blueprint.workspaceId,
        blueprint.name.en,
        blueprint.name.vi,
        blueprint.description.en,
        blueprint.description.vi,
        blueprint.targetPlatform,
        blueprint.hookStyle,
        blueprint.voiceStyle,
        blueprint.durationSeconds,
        blueprint.aspectRatio,
        blueprint.estimatedScenes,
        JSON.stringify(blueprint.suggestedPrompts),
        blueprint.isActive ? 1 : 0,
        blueprint.createdAt,
        blueprint.updatedAt,
      )
      .run();

    return (res.meta?.changes ?? 0) > 0;
  } catch (err) {
    logger.warn('[CampaignGenerator] saveCampaignBlueprint failed', {
      blueprintId: blueprint.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

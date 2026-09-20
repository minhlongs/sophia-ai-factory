/**
 * Campaign Generator — Phase 5: Auto-Creative Playbook (COMPOUND stage)
 *
 * Synthesizes high-performing creative variables (hook styles, duration patterns,
 * audio voice profiles) into repeatable, automated Campaign Blueprint configurations.
 *
 * Evaluates winning patterns in the target workspace:
 * - If pattern confidence >= 0.70, adopts the winning pattern.
 * - If data is insufficient or confidence < 0.70, falls back to robust, high-conversion defaults.
 *
 * Layer: forest (infrastructure and domain orchestration — depends only on seed, tree, and forest)
 *
 * @module forest/playbook/campaign-generator
 */

import type {
  CampaignBlueprint,
  HookStyle,
  VoiceProfile,
  PlaybookPattern,
} from '@/seed/types/playbook-pattern';
import { listPatterns } from '@/forest/patterns/pattern-store';
import { createServerClient, getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/** Minimum statistical confidence required to adopt a detected pattern */
export const MIN_PATTERN_CONFIDENCE = 0.70;

/** Standard multi-track mission generation estimated cost in cents ($1.50) */
export const DEFAULT_ESTIMATED_COST_CENTS = 150;

/** Canonical allowed hook styles for validation */
const VALID_HOOK_STYLES: readonly HookStyle[] = [
  'curiosity_gap',
  'bold_claim',
  'problem_agitation',
  'question',
  'story_lead',
  'statistic_reveal',
] as const;

/** Canonical allowed voice profiles for validation */
const VALID_VOICE_PROFILES: readonly VoiceProfile[] = [
  'dynamic_hook',
  'enthusiastic_recommender',
  'calm_authoritative',
  'cinematic_narrator',
] as const;

/**
 * Maps a target channel/platform string to standard platform and aspect ratio.
 */
function resolvePlatformAndAspectRatio(preferredChannel = 'youtube_shorts'): {
  targetPlatform: 'youtube_shorts' | 'tiktok' | 'instagram_reels';
  aspectRatio: '9:16' | '16:9' | '1:1';
} {
  const normalized = preferredChannel.toLowerCase().trim();

  if (normalized === 'youtube') {
    return { targetPlatform: 'youtube_shorts', aspectRatio: '16:9' };
  }
  if (normalized.includes('tiktok')) {
    return { targetPlatform: 'tiktok', aspectRatio: '9:16' };
  }
  if (normalized.includes('instagram') || normalized.includes('reels')) {
    return { targetPlatform: 'instagram_reels', aspectRatio: '9:16' };
  }
  if (normalized.includes('square') || normalized.includes('feed')) {
    return { targetPlatform: 'instagram_reels', aspectRatio: '1:1' };
  }
  return { targetPlatform: 'youtube_shorts', aspectRatio: '9:16' };
}

/**
 * Maps duration bucket or string to discrete seconds.
 */
function resolveDurationSeconds(patternValue?: string): number {
  if (!patternValue) return 60;
  switch (patternValue) {
    case '0-15s':
      return 15;
    case '16-30s':
      return 25;
    case '31-60s':
      return 60;
    case '61-90s':
      return 75;
    case '90s+':
      return 90;
    default: {
      const parsed = Number(patternValue);
      if (!isNaN(parsed) && parsed > 0) {
        return Math.min(180, Math.max(15, parsed));
      }
      return 60;
    }
  }
}

/**
 * Resolves pattern list and preferred channel from input parameters.
 */
async function resolvePatternsAndChannel(
  workspaceId: string,
  preferredChannelOrPatterns?: string | PlaybookPattern[],
  targetPlatformOverride?: 'youtube_shorts' | 'tiktok' | 'instagram_reels',
): Promise<{ patterns: PlaybookPattern[]; preferredChannel: string }> {
  if (Array.isArray(preferredChannelOrPatterns)) {
    return {
      patterns: preferredChannelOrPatterns,
      preferredChannel: targetPlatformOverride ?? 'youtube_shorts',
    };
  }

  const preferredChannel =
    typeof preferredChannelOrPatterns === 'string'
      ? preferredChannelOrPatterns
      : 'youtube_shorts';

  try {
    const patterns = await listPatterns(workspaceId);
    return { patterns, preferredChannel };
  } catch (err) {
    logger.warn('[CampaignGenerator] Failed loading patterns from store, using defaults', {
      workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { patterns: [], preferredChannel };
  }
}

/**
 * Extracts winning variables or fallback defaults from detected patterns.
 */
function extractWinningVariables(patterns: PlaybookPattern[]): {
  hookStyle: HookStyle;
  durationSeconds: number;
  estimatedScenes: number;
  voiceStyle: VoiceProfile;
  sourcePatternIds: string[];
} {
  const topHookPattern = patterns.find(
    (p) =>
      (p.featureKey === 'hook_style' || p.featureKey === 'hook_type') &&
      p.confidence >= MIN_PATTERN_CONFIDENCE &&
      VALID_HOOK_STYLES.includes(p.featureValue as HookStyle),
  );
  const hookStyle: HookStyle = (topHookPattern?.featureValue as HookStyle) ?? 'curiosity_gap';

  const topDurationPattern = patterns.find(
    (p) => p.featureKey === 'duration' && p.confidence >= MIN_PATTERN_CONFIDENCE,
  );
  const durationSeconds = resolveDurationSeconds(topDurationPattern?.featureValue);
  const estimatedScenes = durationSeconds <= 30 ? 3 : 5;

  const topVoicePattern = patterns.find(
    (p) =>
      p.featureKey === 'voice_style' &&
      p.confidence >= MIN_PATTERN_CONFIDENCE &&
      VALID_VOICE_PROFILES.includes(p.featureValue as VoiceProfile),
  );
  const voiceStyle: VoiceProfile = (topVoicePattern?.featureValue as VoiceProfile) ?? 'dynamic_hook';

  const sourcePatternIds: string[] = [
    topHookPattern?.id,
    topDurationPattern?.id,
    topVoicePattern?.id,
  ].filter((pid): pid is string => typeof pid === 'string' && pid.length > 0);

  return { hookStyle, durationSeconds, estimatedScenes, voiceStyle, sourcePatternIds };
}

/**
 * Generate a repeatable CampaignBlueprint for a given workspace and topic.
 *
 * Evaluates winning patterns (hook_style, duration, voice_style) in the workspace.
 * If confidence >= 0.70, adopts them; otherwise uses production-safe fallback defaults.
 */
export async function generateCampaignBlueprint(
  workspaceId: string,
  topic: string,
  preferredChannelOrPatterns?: string | PlaybookPattern[],
  targetPlatformOverride?: 'youtube_shorts' | 'tiktok' | 'instagram_reels',
): Promise<CampaignBlueprint> {
  const { patterns, preferredChannel } = await resolvePatternsAndChannel(
    workspaceId,
    preferredChannelOrPatterns,
    targetPlatformOverride,
  );

  const { hookStyle, durationSeconds, estimatedScenes, voiceStyle, sourcePatternIds } =
    extractWinningVariables(patterns);

  const { targetPlatform, aspectRatio } = resolvePlatformAndAspectRatio(
    targetPlatformOverride ?? preferredChannel,
  );

  const now = Date.now();
  const id = `bp_${workspaceId}_${now}`;

  const name = {
    en: `${topic} — High Conversion Playbook`,
    vi: `${topic} — Chiến Dịch Tối Ưu Chuyển Đổi`,
  };

  const description = {
    en: `Automated campaign blueprint synthesized from winning patterns (Hook: ${hookStyle}, Voice: ${voiceStyle})`,
    vi: `Kịch bản chiến dịch tự động tổng hợp từ mẫu thắng thế (Mở đầu: ${hookStyle}, Giọng đọc: ${voiceStyle})`,
  };

  const suggestedPrompts = [
    {
      en: `High retention ${hookStyle} script opening for ${topic}`,
      vi: `Lời mở đầu dạng ${hookStyle} giữ chân người xem cho chủ đề ${topic}`,
    },
  ];

  return {
    id,
    workspaceId,
    name,
    description,
    targetPlatform,
    hookStyle,
    voiceStyle,
    durationSeconds,
    aspectRatio,
    estimatedScenes,
    suggestedPrompts,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    estimatedCostCents: DEFAULT_ESTIMATED_COST_CENTS,
    targetChannels: [preferredChannel],
    sourcePatternIds,
  };
}

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

/**
 * Autonomous Daily Campaign Generator — Phase 5: Auto-Creative Playbook
 *
 * Scans all active workspaces in D1 for high-confidence winning patterns
 * (confidence >= minConfidence, default 0.70). Groups patterns by workspace,
 * synthesizes CampaignBlueprint templates with winning variables (hook, voice,
 * duration, platform), and persists them to the campaign_blueprints table.
 *
 * Layer: forest (depends on seed, tree, forest only; zero land imports)
 */
export async function generateDailyCampaignBlueprints(
  db: D1Database,
  minConfidence: number = MIN_PATTERN_CONFIDENCE,
): Promise<CampaignBlueprint[]> {
  const stmt = db.prepare(
    `SELECT id, workspace_id, feature_key, feature_value, metric, avg_metric,
            sample_size, confidence, confidence_level, source, detected_at, created_at
     FROM playbook_patterns
     WHERE confidence >= ?
     ORDER BY workspace_id ASC, confidence DESC, detected_at DESC`,
  );

  const queryRes = await stmt.bind(minConfidence).all<{
    id: string;
    workspace_id: string;
    feature_key: string;
    feature_value: string;
    metric: string;
    avg_metric: number;
    sample_size: number;
    confidence: number;
    confidence_level: 'high' | 'medium' | 'low';
    source: 'mission' | 'experiment' | 'memory' | 'roi';
    detected_at: number;
    created_at: number;
  }>();

  const rawPatterns = queryRes.results ?? [];
  const blueprints: CampaignBlueprint[] = [];

  if (rawPatterns.length === 0) {
    logger.info('[CampaignGenerator] No patterns meet confidence threshold for daily generation', {
      minConfidence,
    });
    return [];
  }

  // Group patterns by workspace_id
  const patternsByWorkspace = new Map<string, PlaybookPattern[]>();
  for (const row of rawPatterns) {
    const p: PlaybookPattern = {
      id: row.id,
      workspaceId: row.workspace_id,
      featureKey: row.feature_key,
      featureValue: row.feature_value,
      metric: row.metric,
      avgMetric: row.avg_metric,
      sampleSize: row.sample_size,
      confidence: row.confidence,
      confidenceLevel: row.confidence_level,
      source: row.source,
      detectedAt: row.detected_at,
    };
    const list = patternsByWorkspace.get(row.workspace_id) || [];
    list.push(p);
    patternsByWorkspace.set(row.workspace_id, list);
  }

  // Synthesize and persist a blueprint for each workspace with winning patterns
  for (const [workspaceId, wsPatterns] of patternsByWorkspace.entries()) {
    try {
      const topHook = wsPatterns.find(
        (p) =>
          (p.featureKey === 'hook_style' || p.featureKey === 'hook_type') &&
          p.confidence >= minConfidence,
      );
      const hookDesc = topHook ? `Top ${topHook.featureValue}` : 'Daily Viral Playbook';
      const topic = `Autonomous Daily Growth — ${hookDesc}`;

      const blueprint = await generateCampaignBlueprint(workspaceId, topic, wsPatterns);
      const saved = await saveCampaignBlueprint(blueprint, db);

      if (saved) {
        blueprints.push(blueprint);
        logger.info('[CampaignGenerator] Successfully synthesized daily blueprint', {
          workspaceId,
          blueprintId: blueprint.id,
          hookStyle: blueprint.hookStyle,
          voiceStyle: blueprint.voiceStyle,
          platform: blueprint.targetPlatform,
        });
      } else {
        logger.warn('[CampaignGenerator] Failed to persist daily blueprint', {
          workspaceId,
          blueprintId: blueprint.id,
        });
      }
    } catch (err) {
      logger.error('[CampaignGenerator] Error generating daily blueprint for workspace', {
        workspaceId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return blueprints;
}


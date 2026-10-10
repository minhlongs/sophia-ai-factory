import type { CampaignBlueprint, PlaybookPattern } from '@/seed/types/playbook-pattern';
import { listPatterns } from '@/forest/patterns/pattern-store';
import { logger } from '@/seed/utils/logger-utility';
import {
  DEFAULT_ESTIMATED_COST_CENTS,
  type TargetPlatform,
} from './types';
import {
  resolvePlatformAndAspectRatio,
  extractWinningVariables,
} from './step-prompt-builder';

/**
 * Resolves pattern list and preferred channel from input parameters.
 */
async function resolvePatternsAndChannel(
  workspaceId: string,
  preferredChannelOrPatterns?: string | PlaybookPattern[],
  targetPlatformOverride?: TargetPlatform,
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
 * Generate a repeatable CampaignBlueprint for a given workspace and topic.
 */
export async function generateCampaignBlueprint(
  workspaceId: string,
  topic: string,
  preferredChannelOrPatterns?: string | PlaybookPattern[],
  targetPlatformOverride?: TargetPlatform,
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

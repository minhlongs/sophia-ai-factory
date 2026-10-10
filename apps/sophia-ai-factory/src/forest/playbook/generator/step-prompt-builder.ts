import type { HookStyle, VoiceProfile, PlaybookPattern } from '@/seed/types/playbook-pattern';
import {
  MIN_PATTERN_CONFIDENCE,
  VALID_HOOK_STYLES,
  VALID_VOICE_PROFILES,
  type TargetPlatform,
  type AspectRatio,
} from './types';

/**
 * Maps a target channel/platform string to standard platform and aspect ratio.
 */
export function resolvePlatformAndAspectRatio(preferredChannel = 'youtube_shorts'): {
  targetPlatform: TargetPlatform;
  aspectRatio: AspectRatio;
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
export function resolveDurationSeconds(patternValue?: string): number {
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
 * Extracts winning variables or fallback defaults from detected patterns.
 */
export function extractWinningVariables(patterns: PlaybookPattern[]): {
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

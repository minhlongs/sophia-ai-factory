import {
  type PlatformType,
  type HookMutationResult,
  normalizePlatform,
} from './types';

/**
 * Mutates video hook and tags to match native platform virality patterns,
 * avoiding generic shadowban watermarks.
 */
export function mutatePlatformHook(
  title: string,
  tags: string[],
  targetPlatform: PlatformType | string
): HookMutationResult {
  const platform = normalizePlatform(targetPlatform);
  const cleanTitle = (title || '').trim() || 'Untitled Viral Short';

  // Sanitize tags: trim, lowercase, strip leading hash
  const initialTags = (tags || [])
    .map((t) => t.trim().toLowerCase().replace(/^#+/, ''))
    .filter((t) => t.length > 0);

  let mutatedTitle = cleanTitle;
  let hookStrategy = '';
  const platformTags: string[] = [];

  switch (platform) {
    case 'TIKTOK': {
      hookStrategy = '3s High-Pacing Cut + Sound Tag';
      platformTags.push('fyp', 'viral', 'trending', 'tiktokmademebuyit');
      if (!/^(pov:|wait for it|secret:|watch till)/i.test(cleanTitle)) {
        mutatedTitle = `POV: ${cleanTitle}`;
      }
      break;
    }
    case 'YOUTUBE_SHORTS': {
      hookStrategy = 'Looping Audio Endcard + Curiosity Title';
      platformTags.push('shorts', 'youtubeshorts', 'viral', 'trendingshorts');
      if (!/\[watch till end\]|\(wait what\?\)|#shorts/i.test(cleanTitle)) {
        mutatedTitle = `${cleanTitle} [Watch Till End]`;
      }
      break;
    }
    case 'INSTAGRAM_REELS': {
      hookStrategy = 'Send to a friend Trigger Text + Aesthetic Tags';
      platformTags.push('reels', 'reelsinstagram', 'explorepage', 'viralreels');
      if (!/^(send this to|share with|tag someone)/i.test(cleanTitle)) {
        mutatedTitle = `Send this to someone: ${cleanTitle}`;
      }
      break;
    }
  }

  const tagSet = new Set<string>([...initialTags, ...platformTags]);
  const mutatedTags = Array.from(tagSet);

  return {
    mutatedTitle,
    mutatedTags,
    hookStrategy,
    targetPlatform: platform,
  };
}

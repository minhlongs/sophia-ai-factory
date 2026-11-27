/**
 * Zero-GPU B-Roll Stock Media & Semantic Scene Matcher.
 *
 * Clean-room pure-TS engine (MIT patterns from adewale/yaket,
 * alpvatansever8/automated-video-pipeline, and MoneyPrinterTurbo):
 * - Extracts top scene keywords deterministically ($0 LLM COGS).
 * - Scores candidate 9:16 vertical B-roll clips by aspect ratio, duration fit,
 *   and commercial license eligibility with joker fallback terms.
 *
 * Layer: seed/video (pure deterministic scoring, zero external deps)
 *
 * @module seed/video/broll-scene-matcher
 */

export interface BrollCandidate {
  readonly id: string;
  readonly provider: 'pexels' | 'pixabay' | 'coverr';
  readonly width: number;
  readonly height: number;
  readonly durationSec: number;
  readonly commercialAllowed: boolean;
  readonly keywords: readonly string[];
}

export interface BrollMatchResult {
  readonly selectedId: string | null;
  readonly score100: number;
  readonly fallbackSearchTerm: string;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'into', 'here', 'how', 'are',
  'cua', 'cho', 'voi', 'nhung', 'trong', 'nguoi', 'duoc', 'khong', 'ban', 'nay',
]);

export function extractSceneKeywords(sceneNarration: string, maxTerms: number = 3): readonly string[] {
  const tokens = sceneNarration
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));

  const unique: string[] = [];
  for (const t of tokens) {
    if (!unique.includes(t)) unique.push(t);
    if (unique.length >= maxTerms) break;
  }
  return unique.length > 0 ? unique : ['finance', 'technology'];
}

export function matchBestVerticalBroll(
  sceneNarration: string,
  targetDurationSec: number,
  candidates: readonly BrollCandidate[],
): BrollMatchResult {
  const sceneTerms = extractSceneKeywords(sceneNarration);
  let bestId: string | null = null;
  let bestScore = -1;

  for (const c of candidates) {
    if (!c.commercialAllowed || c.width <= 0 || c.height <= 0) continue;
    const isVertical = c.height > c.width;
    const aspectScore = isVertical ? 40 : 10;
    const durationScore = c.durationSec >= targetDurationSec ? 30 : 15;
    const overlap = c.keywords.filter((k) => sceneTerms.includes(k.toLowerCase())).length;
    const keywordScore = Math.min(30, overlap * 15);
    const total = aspectScore + durationScore + keywordScore;

    if (total > bestScore) {
      bestScore = total;
      bestId = c.id;
    }
  }

  return {
    selectedId: bestId,
    score100: Math.max(0, bestScore),
    fallbackSearchTerm: sceneTerms[0] ?? 'technology',
  };
}

/**
 * Zero-GPU Viral Thumbnail Safe-Zone Linter, WCAG Contrast & Frame-1 Hook Scorer.
 *
 * Clean-room pure-TS engine (MIT patterns from viewgum/short-form-video-specs,
 * devherex/social-safe-zone, and WCAG 2.2 luminance math):
 * runs in 0ms on Cloudflare Workers / browser with $0 GPU COGS.
 *
 * Layer: seed/video (pure deterministic geometry & color math, zero deps)
 *
 * @module seed/video/frame1-hook-scorer
 */

export type ShortFormPlatform = 'tiktok' | 'youtube_shorts' | 'instagram_reels';

export interface OverlayRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Frame1HookInput {
  readonly platform: ShortFormPlatform;
  readonly headline: string;
  readonly textHex: string;
  readonly bgHex: string;
  readonly textBox: OverlayRect;
}

export interface Frame1HookReport {
  readonly score100: number;
  readonly contrastRatio: number;
  readonly wcagAaPass: boolean;
  readonly safeZoneClear: boolean;
  readonly wordCount: number;
  readonly warnings: readonly string[];
}

const PLATFORM_SAFE_MARGINS: Record<
  ShortFormPlatform,
  { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number }
> = {
  tiktok: { top: 130, bottom: 480, left: 60, right: 120 },
  youtube_shorts: { top: 160, bottom: 420, left: 60, right: 140 },
  instagram_reels: { top: 269, bottom: 672, left: 65, right: 65 },
};

function parseHexToRgb(hex: string): readonly [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [255, 255, 255];
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function computeWcagContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function scoreFrame1VisualHook(input: Frame1HookInput): Frame1HookReport {
  const m = PLATFORM_SAFE_MARGINS[input.platform];
  const safeZoneClear =
    input.textBox.x >= m.left &&
    input.textBox.y >= m.top &&
    input.textBox.x + input.textBox.width <= 1080 - m.right &&
    input.textBox.y + input.textBox.height <= 1920 - m.bottom;

  const contrastRatio = computeWcagContrastRatio(input.textHex, input.bgHex);
  const wcagAaPass = contrastRatio >= 4.5;
  const wordCount = input.headline.trim().split(/\s+/).filter(Boolean).length;
  const wordBudgetOk = wordCount >= 2 && wordCount <= 8;

  const warnings: string[] = [];
  if (!safeZoneClear) warnings.push(`Text overlaps ${input.platform} UI dead zone`);
  if (!wcagAaPass) warnings.push(`Contrast ${contrastRatio}:1 below WCAG AA (4.5:1)`);
  if (!wordBudgetOk) warnings.push(`Headline has ${wordCount} words (ideal 2–8 words)`);

  let score = 0;
  if (safeZoneClear) score += 40;
  if (wcagAaPass) score += 35;
  else if (contrastRatio >= 3.0) score += 20;
  if (wordBudgetOk) score += 25;
  else if (wordCount > 0) score += 10;

  return {
    score100: score,
    contrastRatio,
    wcagAaPass,
    safeZoneClear,
    wordCount,
    warnings,
  };
}

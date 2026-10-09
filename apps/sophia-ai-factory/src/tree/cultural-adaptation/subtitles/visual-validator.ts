/**
 * Visual Cultural Taboo & Contrast Validator
 *
 * @module tree/cultural-adaptation/subtitles/visual-validator
 */

import { getSubtitleCulturalBudget } from './budget-registry';

export interface VisualValidationResult {
  compliant: boolean;
  warnings: string[];
  contrastRatio: number;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Validate color contrast (WCAG AA requirement >= 4.5:1) and cultural taboo pairing.
 */
export function validateCulturalVisuals(
  colors: { background: string; foreground: string },
  symbols: string[],
  locale: string,
): VisualValidationResult {
  const budget = getSubtitleCulturalBudget(locale);
  const warnings: string[] = [];

  // Calculate WCAG contrast ratio
  let contrastRatio = 21.0;
  try {
    const bg = parseHexColor(colors.background);
    const fg = parseHexColor(colors.foreground);
    const l1 = getRelativeLuminance(fg.r, fg.g, fg.b);
    const l2 = getRelativeLuminance(bg.r, bg.g, bg.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    contrastRatio = Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;

    if (contrastRatio < 4.5) {
      warnings.push(`Low subtitle color contrast ratio (${contrastRatio}:1). WCAG AA requires at least 4.5:1.`);
    }
  } catch {
    // Non-hex color passed, skip calculation
  }

  // Check taboo color pairs
  for (const [tabooBg, tabooFg] of budget.tabooColorPairs) {
    if (
      colors.background.toUpperCase() === tabooBg.toUpperCase() &&
      colors.foreground.toUpperCase() === tabooFg.toUpperCase()
    ) {
      warnings.push(
        `Color combination (${colors.background}, ${colors.foreground}) is considered culturally inauspicious or taboo in ${budget.locale.toUpperCase()} locale.`,
      );
    }
  }

  // Check taboo symbols
  if (budget.tabooSymbols) {
    for (const sym of symbols) {
      if (budget.tabooSymbols.includes(sym)) {
        warnings.push(`Symbol '${sym}' holds negative or taboo cultural connotations in ${budget.locale.toUpperCase()} locale.`);
      }
    }
  }

  return {
    compliant: warnings.length === 0,
    warnings,
    contrastRatio,
  };
}

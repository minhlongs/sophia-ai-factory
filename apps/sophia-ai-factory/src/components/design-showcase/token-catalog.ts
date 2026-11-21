/**
 * ZEN DESIGN OS v1.0 — Token Catalog & Export Helpers
 * Pure TypeScript utilities deriving searchable DTCG rows, tonal palettes,
 * CSS custom property exports, and serialized DTCG JSON directly from
 * the canonical seed contract (`@/seed/design-tokens`).
 */

import {
  ZEN_DESIGN_TOKENS,
  auditZenThemeContrast,
  getZenMotionEasingCss,
  type WcagContrastAuditRow,
  type ZenMotionDurationRole,
  type ZenMotionEasingRole,
  type ZenSemanticColorRole,
  type ZenThemeMode,
} from '@/seed/design-tokens';

export type DtcgCategory =
  | 'semantic-dark'
  | 'semantic-light'
  | 'tonal'
  | 'typography'
  | 'motion';

export interface FlatDtcgTokenRow {
  id: string;
  path: string;
  category: DtcgCategory;
  type: string;
  value: string;
  cssVar: string | null;
  description: string;
  isColor: boolean;
}

export interface SemanticTokenEntry {
  role: ZenSemanticColorRole;
  cssVar: string;
  darkValue: string;
  lightValue: string;
}

export interface TonalPaletteGroup {
  family: string;
  swatches: Array<{
    tone: string;
    value: string;
    description: string;
    tokenPath: string;
  }>;
}

export interface MotionDurationEntry {
  role: ZenMotionDurationRole;
  cssVar: string;
  value: string;
  description: string;
}

export interface MotionEasingEntry {
  role: ZenMotionEasingRole;
  cssVar: string;
  cssValue: string;
  tuple: readonly number[];
  description: string;
}

export function getSemanticTokenEntries(): SemanticTokenEntry[] {
  const darkMap = ZEN_DESIGN_TOKENS.color.semantic.dark;
  const lightMap = ZEN_DESIGN_TOKENS.color.semantic.light;
  const roles = Object.keys(darkMap) as ZenSemanticColorRole[];

  return roles.map((role) => ({
    role,
    cssVar: `--${role}`,
    darkValue: darkMap[role].$value,
    lightValue: lightMap[role].$value,
  }));
}

export function getTonalPaletteGroups(): TonalPaletteGroup[] {
  const tonal = ZEN_DESIGN_TOKENS.color.tonal;
  return Object.entries(tonal).map(([family, tones]) => ({
    family,
    swatches: Object.entries(tones).map(([tone, entry]) => ({
      tone,
      value: entry.$value,
      description: entry.$description,
      tokenPath: `color.tonal.${family}.${tone}`,
    })),
  }));
}

export function getMotionDurationEntries(): MotionDurationEntry[] {
  const durations = ZEN_DESIGN_TOKENS.motion.duration;
  const roles = Object.keys(durations) as ZenMotionDurationRole[];
  return roles.map((role) => ({
    role,
    cssVar: `--motion-duration-${role}`,
    value: durations[role].$value,
    description: durations[role].$description,
  }));
}

export function getMotionEasingEntries(): MotionEasingEntry[] {
  const easings = ZEN_DESIGN_TOKENS.motion.easing;
  const roles = Object.keys(easings) as ZenMotionEasingRole[];
  return roles.map((role) => ({
    role,
    cssVar: `--motion-ease-${role}`,
    cssValue: getZenMotionEasingCss(role),
    tuple: easings[role].$value,
    description: easings[role].$description,
  }));
}

export function getContrastAuditByMode(mode: ZenThemeMode): WcagContrastAuditRow[] {
  return auditZenThemeContrast(mode);
}

export function buildFlatDtcgRows(): FlatDtcgTokenRow[] {
  const rows: FlatDtcgTokenRow[] = [];

  for (const [role, entry] of Object.entries(ZEN_DESIGN_TOKENS.color.semantic.dark)) {
    rows.push({
      id: `semantic-dark-${role}`,
      path: `color.semantic.dark.${role}`,
      category: 'semantic-dark',
      type: entry.$type,
      value: entry.$value,
      cssVar: `--${role}`,
      description: `Dark semantic role: ${role}`,
      isColor: true,
    });
  }

  for (const [role, entry] of Object.entries(ZEN_DESIGN_TOKENS.color.semantic.light)) {
    rows.push({
      id: `semantic-light-${role}`,
      path: `color.semantic.light.${role}`,
      category: 'semantic-light',
      type: entry.$type,
      value: entry.$value,
      cssVar: `--${role}`,
      description: `Light semantic role: ${role}`,
      isColor: true,
    });
  }

  for (const [family, tones] of Object.entries(ZEN_DESIGN_TOKENS.color.tonal)) {
    for (const [tone, entry] of Object.entries(tones)) {
      rows.push({
        id: `tonal-${family}-${tone}`,
        path: `color.tonal.${family}.${tone}`,
        category: 'tonal',
        type: entry.$type,
        value: entry.$value,
        cssVar: null,
        description: entry.$description,
        isColor: true,
      });
    }
  }

  for (const [role, entry] of Object.entries(ZEN_DESIGN_TOKENS.typography.fontFamily)) {
    rows.push({
      id: `typography-${role}`,
      path: `typography.fontFamily.${role}`,
      category: 'typography',
      type: entry.$type,
      value: entry.$value.join(', '),
      cssVar: `--font-${role}`,
      description: `Font stack for ${role}`,
      isColor: false,
    });
  }

  for (const [role, entry] of Object.entries(ZEN_DESIGN_TOKENS.motion.duration)) {
    rows.push({
      id: `motion-duration-${role}`,
      path: `motion.duration.${role}`,
      category: 'motion',
      type: entry.$type,
      value: entry.$value,
      cssVar: `--motion-duration-${role}`,
      description: entry.$description,
      isColor: false,
    });
  }

  for (const [role, entry] of Object.entries(ZEN_DESIGN_TOKENS.motion.easing)) {
    const easingRole = role as ZenMotionEasingRole;
    rows.push({
      id: `motion-easing-${role}`,
      path: `motion.easing.${role}`,
      category: 'motion',
      type: entry.$type,
      value: getZenMotionEasingCss(easingRole),
      cssVar: `--motion-ease-${role}`,
      description: entry.$description,
      isColor: false,
    });
  }

  return rows;
}

export function buildCssVariablesExport(mode: ZenThemeMode): string {
  const semantic = ZEN_DESIGN_TOKENS.color.semantic[mode];
  const durations = getMotionDurationEntries();
  const easings = getMotionEasingEntries();
  const selector = mode === 'dark' ? '.dark' : ':root';

  const lines: string[] = [
    `/* ${ZEN_DESIGN_TOKENS.meta.system} v${ZEN_DESIGN_TOKENS.meta.version} — ${mode.toUpperCase()} */`,
    `${selector} {`,
  ];

  for (const [role, entry] of Object.entries(semantic)) {
    lines.push(`  --${role}: ${entry.$value};`);
  }

  for (const duration of durations) {
    lines.push(`  ${duration.cssVar}: ${duration.value};`);
  }

  for (const easing of easings) {
    lines.push(`  ${easing.cssVar}: ${easing.cssValue};`);
  }

  lines.push('}');
  return lines.join('\n');
}

export function serializeDtcgJson(): string {
  return `${JSON.stringify(ZEN_DESIGN_TOKENS, null, 2)}\n`;
}

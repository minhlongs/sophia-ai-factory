/**
 * guide-inspector-items.ts
 * Normalizes the two guide catalogues into one inspector item, so the component
 * body has a single render path instead of branching on stage vs pillar.
 * Layer: app/[locale]/guide (client island helper; no JSX, no DOM)
 */

import {
  GUIDE_BACKEND_PILLARS,
  GUIDE_CIRCUIT_WIRES,
  GUIDE_PIPELINE_STAGES,
  type GuideActiveTarget,
  type GuidePillarNumber,
  type GuideStageStep,
} from '@/seed/guide';
import type { GuideLocale } from './guide-schematic-nodes';

export type GuideMode = 'stage' | 'pillar';

export type Bullet = readonly [label: string, text: string];

/** Both catalogue shapes collapse into one normalized item so the body is single-path. */
export interface InspectorItem {
  readonly icon: string;
  readonly badge: string;
  readonly title: string;
  readonly value: string;
  readonly bullets: readonly Bullet[];
  readonly proofCaption: string;
  readonly proofLines: readonly string[];
  readonly counterTemplate: string;
  readonly index: number;
  readonly total: number;
}

/** Plain, serializable chrome strings; never a server `t` function. */
export interface GuideInspectorLabels {
  readonly inputLabel: string;
  readonly engineLabel: string;
  readonly outputLabel: string;
  readonly capabilitiesLabel: string;
  readonly safetyLabel: string;
  readonly proofLabel: string;
  readonly crossLinkLabel: string;
  readonly previous: string;
  readonly next: string;
  readonly quickSelect: string;
  readonly counterStage: string;
  readonly counterPillar: string;
}

/** Quick-select dots per mode, built once from the catalogue order. */
export const RAIL: Record<GuideMode, readonly GuideActiveTarget[]> = {
  stage: GUIDE_PIPELINE_STAGES.map((s) => ({ mode: 'stage' as const, step: s.step as GuideStageStep })),
  pillar: GUIDE_BACKEND_PILLARS.map((p) => ({ mode: 'pillar' as const, number: p.number as GuidePillarNumber })),
};

function two(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** Fills the counter template ("TRẠM {index} / {total}") Phase 4 supplies. */
export function formatCounter(template: string, index: number, total: number): string {
  return template.replace('{index}', two(index)).replace('{total}', two(total));
}

/**
 * Keeps an index inside the existing catalogue range so a lookup can never
 * miss. The index arrives from a URL hash, so it is untrusted by construction.
 */
function clampIndex(index: number, count: number): number {
  if (!Number.isInteger(index) || index < 1) return 1;
  return Math.min(index, count);
}

export function buildStageItem(
  step: number,
  locale: GuideLocale,
  labels: GuideInspectorLabels,
): InspectorItem {
  const safeStep = clampIndex(step, GUIDE_PIPELINE_STAGES.length);
  const stage = GUIDE_PIPELINE_STAGES[safeStep - 1];
  return {
    icon: two(safeStep),
    badge: `STAGE ${two(safeStep)}`,
    title: stage.name[locale],
    value: stage.subtitle[locale],
    bullets: [
      [labels.inputLabel, stage.input[locale]],
      [labels.engineLabel, stage.engine[locale]],
      [labels.outputLabel, stage.output[locale]],
    ],
    proofCaption: labels.proofLabel,
    proofLines: [stage.sampleCommand, stage.sampleResult],
    counterTemplate: labels.counterStage,
    index: safeStep,
    total: RAIL.stage.length,
  };
}

export function buildPillarItem(
  number: number,
  locale: GuideLocale,
  labels: GuideInspectorLabels,
): InspectorItem {
  const safeNumber = clampIndex(number, GUIDE_BACKEND_PILLARS.length);
  const pillar = GUIDE_BACKEND_PILLARS[safeNumber - 1];
  return {
    icon: pillar.icon,
    badge: pillar.badge,
    title: pillar.title[locale],
    value: pillar.description[locale],
    bullets: pillar.capabilities.map((cap) => [labels.capabilitiesLabel, cap[locale]] as const),
    proofCaption: labels.safetyLabel,
    proofLines: pillar.representativeRoutes.slice(0, 2),
    counterTemplate: labels.counterPillar,
    index: safeNumber,
    total: RAIL.pillar.length,
  };
}

/** The item the inspector shows: exactly one station or one pillar. */
export function buildInspectorItem(
  mode: GuideMode,
  index: number,
  locale: GuideLocale,
  labels: GuideInspectorLabels,
): InspectorItem {
  return mode === 'stage' ? buildStageItem(index, locale, labels) : buildPillarItem(index, locale, labels);
}

/** Cross-links: the nodes wired to this one on the opposite mode. */
export function crossLinks(mode: GuideMode, index: number): readonly GuideActiveTarget[] {
  const wires =
    mode === 'stage'
      ? GUIDE_CIRCUIT_WIRES.filter((w) => w.stageStep === index)
      : GUIDE_CIRCUIT_WIRES.filter((w) => w.pillarNumber === index);
  return wires.map((w) =>
    mode === 'stage'
      ? { mode: 'pillar' as const, number: w.pillarNumber as GuidePillarNumber }
      : { mode: 'stage' as const, step: w.stageStep as GuideStageStep },
  );
}

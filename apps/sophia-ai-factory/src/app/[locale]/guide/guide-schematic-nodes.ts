/**
 * guide-schematic-nodes.ts
 * Projects the seed catalog onto fixed canvas geometry so the component only renders.
 * Layer: app/[locale]/guide (client island helper)
 */

import {
  GUIDE_BACKEND_PILLARS,
  GUIDE_PIPELINE_STAGES,
  GUIDE_SVG_COORDS,
  type GuideActiveTarget,
  type GuidePillarNumber,
  type GuideStageStep,
} from '@/seed/guide';

export type GuideLocale = 'vi' | 'en';

export type SimPhase = 'IDLE' | 'INPUT' | 'ENGINE' | 'OUTPUT';

/** Plain, serializable chrome strings the schematic renders; never a server `t` function. */
export interface GuideSchematicCanvasLabels {
  readonly stationPrefix: string;
  readonly pillarPrefix: string;
  readonly selected: string;
  readonly idle: string;
  readonly simulate: string;
  readonly stop: string;
  readonly serialEmpty: string;
  /** Names the diagram itself; the nodes carry their own accessible names. */
  readonly canvasLabel: string;
  readonly phases: Readonly<Record<SimPhase, string>>;
}

/** One clickable node: geometry plus the bilingual copy its aria-label carries. */
export interface GuideCanvasNode {
  readonly id: string;
  readonly cx: number;
  readonly cy: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly order: string;
  readonly ariaPrefix: string;
  readonly name: string;
  readonly caption: string;
  readonly target: GuideActiveTarget;
  readonly isActive: boolean;
}

const STATION_SIZE = { width: 88, height: 44, radius: 6 } as const;
const CHIP_SIZE = { width: 72, height: 28, radius: 14 } as const;

function clip(value: string): string {
  return value.length > 15 ? `${value.slice(0, 14)}…` : value;
}

/**
 * Builds both rows of the schematic: the 5 stations on the upper bus and the
 * 8 pillar chips on the lower row. Geometry comes from the topology module.
 */
export function buildGuideCanvasNodes(
  activeTarget: GuideActiveTarget,
  locale: GuideLocale,
  stationPrefix: string,
  pillarPrefix: string,
): readonly GuideCanvasNode[] {
  const stageMode = activeTarget.mode === 'stage';
  const stations: readonly GuideCanvasNode[] = GUIDE_PIPELINE_STAGES.map((item, index) => {
    const c = GUIDE_SVG_COORDS.stations[index];
    return {
      id: `s-${item.step}`,
      cx: c.x,
      cy: c.y,
      ...STATION_SIZE,
      order: String(item.step),
      ariaPrefix: stationPrefix,
      name: item.name[locale],
      caption: clip(item.name[locale]),
      target: { mode: 'stage', step: item.step as GuideStageStep },
      isActive: stageMode && activeTarget.step === item.step,
    };
  });
  const chips: readonly GuideCanvasNode[] = GUIDE_BACKEND_PILLARS.map((item, index) => {
    const c = GUIDE_SVG_COORDS.chips[index];
    return {
      id: `p-${item.id}`,
      cx: c.x,
      cy: c.y,
      ...CHIP_SIZE,
      order: String(item.number),
      ariaPrefix: pillarPrefix,
      name: item.title[locale],
      caption: clip(`${item.icon} ${item.title[locale]}`),
      target: { mode: 'pillar', number: item.number as GuidePillarNumber },
      isActive: !stageMode && activeTarget.number === item.number,
    };
  });
  return [...stations, ...chips];
}

/** Serial-monitor payload: real seed data, never a network call. */
export function buildGuideSerialPayload(
  activeTarget: GuideActiveTarget,
  locale: GuideLocale,
  emptyRouteLabel: string,
): string {
  if (activeTarget.mode === 'stage') {
    const stage = GUIDE_PIPELINE_STAGES[activeTarget.step - 1];
    return `${stage?.sampleCommand ?? ''}\n${stage?.sampleResult ?? ''}`;
  }
  const pillar = GUIDE_BACKEND_PILLARS[activeTarget.number - 1];
  return `${pillar?.representativeRoutes[0] ?? emptyRouteLabel}\n${pillar?.safetyPillar[locale] ?? ''}`;
}

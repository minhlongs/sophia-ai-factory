/**
 * guide-circuit-topology.ts
 * Static stage-to-pillar wire map and canvas coordinates for the guide workbench.
 * Layer: seed/guide
 */

import { GUIDE_PIPELINE_STAGES } from './guide-backend-catalog';
import { GUIDE_BACKEND_PILLARS } from './guide-backend-pillars-data';
import type { GuideActiveTarget, GuidePillarNumber, GuideStageStep } from './guide-hash-codec';

/** One wire joining a pipeline station to the backend pillar that powers it. */
export interface GuideCircuitWire {
  readonly stageStep: GuideStageStep;
  readonly pillarNumber: GuidePillarNumber;
}

/**
 * The peer a target crosses to in the other mode: the first wire that matches,
 * in table order. A station with more than one wired pillar always crosses to
 * the first listed one, so the mapping is a product decision encoded in
 * `GUIDE_CIRCUIT_WIRES` rather than whichever pillar happens to sort first.
 * Returns null when nothing is wired, so a caller can no-op instead of guessing.
 */
export function crossPeer(target: GuideActiveTarget): GuideActiveTarget | null {
  if (target.mode === 'stage') {
    const wire = GUIDE_CIRCUIT_WIRES.find((w) => w.stageStep === target.step);
    return wire === undefined ? null : { mode: 'pillar', number: wire.pillarNumber };
  }
  const wire = GUIDE_CIRCUIT_WIRES.find((w) => w.pillarNumber === target.number);
  return wire === undefined ? null : { mode: 'stage', step: wire.stageStep };
}

/** One station node on the upper canvas bus. */
export interface GuideStationCoord {
  readonly step: GuideStageStep;
  readonly x: number;
  readonly y: number;
  readonly label: { readonly vi: string; readonly en: string };
}

/** One pillar chip on the lower canvas row. */
export interface GuidePillarCoord {
  readonly number: GuidePillarNumber;
  readonly x: number;
  readonly y: number;
  readonly label: { readonly vi: string; readonly en: string };
}

const STATION_Y = 110;
const CHIP_Y = 320;
const CANVAS_WIDTH = 680;
const CANVAS_HEIGHT = 420;
const SIDE_MARGIN = 70;

function slot(index: number, count: number): number {
  const usable = CANVAS_WIDTH - SIDE_MARGIN * 2;
  return SIDE_MARGIN + (usable / (count - 1)) * index;
}

/** The Linked Station Matrix: which pillar powers which pipeline stage. */
export const GUIDE_CIRCUIT_WIRES: ReadonlyArray<GuideCircuitWire> = [
  { stageStep: 1, pillarNumber: 1 },
  { stageStep: 1, pillarNumber: 8 },
  { stageStep: 2, pillarNumber: 3 },
  { stageStep: 2, pillarNumber: 7 },
  { stageStep: 3, pillarNumber: 2 },
  { stageStep: 4, pillarNumber: 4 },
  { stageStep: 4, pillarNumber: 5 },
  { stageStep: 4, pillarNumber: 6 },
  { stageStep: 5, pillarNumber: 3 },
  { stageStep: 5, pillarNumber: 7 },
  { stageStep: 5, pillarNumber: 8 },
];

/** Five stations laid left-to-right along the upper bus. */
export const GUIDE_SVG_STATIONS: ReadonlyArray<GuideStationCoord> = GUIDE_PIPELINE_STAGES.map(
  (stage, index) => ({
    step: stage.step as GuideStageStep,
    x: slot(index, GUIDE_PIPELINE_STAGES.length),
    y: STATION_Y,
    label: { vi: `Trạm ${stage.step}`, en: `Station ${stage.step}` },
  }),
);

/** Eight chips laid left-to-right along the lower row. */
export const GUIDE_SVG_CHIPS: ReadonlyArray<GuidePillarCoord> = GUIDE_BACKEND_PILLARS.map(
  (pillar, index) => ({
    number: pillar.number as GuidePillarNumber,
    x: slot(index, GUIDE_BACKEND_PILLARS.length),
    y: CHIP_Y,
    label: { vi: pillar.title.vi, en: pillar.title.en },
  }),
);

/** Both coordinate banks, ready for the SVG canvas in the UI layer. */
export const GUIDE_SVG_COORDS: Readonly<{
  readonly viewBox: string;
  readonly stations: ReadonlyArray<GuideStationCoord>;
  readonly chips: ReadonlyArray<GuidePillarCoord>;
}> = {
  viewBox: `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`,
  stations: GUIDE_SVG_STATIONS,
  chips: GUIDE_SVG_CHIPS,
};

/**
 * Barrel export for guide catalog and backend pillars.
 * Layer: seed/guide
 */

export type { BackendPillar, PipelineStage } from './guide-backend-pillars';
export { GUIDE_BACKEND_STATS, GUIDE_PIPELINE_STAGES } from './guide-backend-catalog';
export { GUIDE_BACKEND_PILLARS } from './guide-backend-pillars-data';
export type { GuideActiveTarget, GuidePillarNumber, GuideStageStep } from './guide-hash-codec';
export { formatGuideHash, GUIDE_PILLAR_ALIASES, parseGuideHash, stepGuideTarget } from './guide-hash-codec';
export type { GuideCircuitWire, GuidePillarCoord, GuideStationCoord } from './guide-circuit-topology';
export { GUIDE_CIRCUIT_WIRES, GUIDE_SVG_CHIPS, GUIDE_SVG_COORDS, GUIDE_SVG_STATIONS, crossPeer } from './guide-circuit-topology';

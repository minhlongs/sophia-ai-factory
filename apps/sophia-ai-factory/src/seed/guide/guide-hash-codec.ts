/**
 * guide-hash-codec.ts
 * Pure URL-hash codec for the interactive guide workbench.
 * Layer: seed/guide
 */

import { GUIDE_PIPELINE_STAGES } from './guide-backend-catalog';
import { GUIDE_BACKEND_PILLARS } from './guide-backend-pillars-data';

/** The guide view resolves a hash into exactly one active target. */
export type GuideActiveTarget =
  | { readonly mode: 'stage'; readonly step: GuideStageStep }
  | { readonly mode: 'pillar'; readonly number: GuidePillarNumber };

/** Pipeline stage index, derived from the catalog length (5 today). */
export type GuideStageStep =
  1 | 2 | 3 | 4 | 5;

/** Backend pillar index, derived from the catalog length (8 today). */
export type GuidePillarNumber =
  1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const STAGE_COUNT = GUIDE_PIPELINE_STAGES.length;
const PILLAR_COUNT = GUIDE_BACKEND_PILLARS.length;

/** Deep-link slugs that resolve straight to a pillar. */
export const GUIDE_PILLAR_ALIASES: Readonly<Record<string, GuidePillarNumber>> = {
  byok: 1,
  video: 2,
  affiliate: 3,
  governance: 4,
  compliance: 5,
  omnichannel: 6,
  telegram: 7,
  economics: 8,
};

const STAGE_PATTERN = /^stage-(\d)$/;
const PILLAR_PATTERN = /^pillar-(\d)$/;

function parseStage(raw: string): GuideActiveTarget | null {
  const digits = STAGE_PATTERN.exec(raw);
  if (digits === null) return null;
  const step = Number(digits[1]);
  return step >= 1 && step <= STAGE_COUNT ? { mode: 'stage', step: step as GuideStageStep } : null;
}

function parsePillar(raw: string): GuideActiveTarget | null {
  const digits = PILLAR_PATTERN.exec(raw);
  if (digits === null) return null;
  const number = Number(digits[1]);
  return number >= 1 && number <= PILLAR_COUNT ? { mode: 'pillar', number: number as GuidePillarNumber } : null;
}

function parseAlias(raw: string): GuideActiveTarget | null {
  // Own-property lookup only: the hash is user-controlled, so prototype members
  // such as "constructor" must not resolve into a pillar index.
  if (!Object.hasOwn(GUIDE_PILLAR_ALIASES, raw)) return null;
  const number = GUIDE_PILLAR_ALIASES[raw];
  return Number.isInteger(number) ? { mode: 'pillar', number } : null;
}

export function parseGuideHash(hash: string): GuideActiveTarget | null {
  const raw = hash.replace(/^#/, '').trim().toLowerCase();
  return parseStage(raw) ?? parsePillar(raw) ?? parseAlias(raw);
}

export function formatGuideHash(target: GuideActiveTarget): string {
  return target.mode === 'stage' ? `#stage-${target.step}` : `#pillar-${target.number}`;
}

export function stepGuideTarget(target: GuideActiveTarget, delta: -1 | 1): GuideActiveTarget {
  if (target.mode === 'pillar') {
    const min = 1;
    const max = PILLAR_COUNT;
    return { mode: 'pillar', number: Math.min(Math.max(target.number + delta, min), max) as GuidePillarNumber };
  }
  const min = 1;
  const max = STAGE_COUNT;
  return { mode: 'stage', step: Math.min(Math.max(target.step + delta, min), max) as GuideStageStep };
}

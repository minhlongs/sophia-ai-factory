/**
 * Seeded blind evaluation packet generator and isolation verifier.
 * Keeps arm-to-output mapping strictly separate from reviewer-facing packets.
 *
 * @module land/eval/first-value-benchmark/blind-scoring
 */

import { createHash } from 'node:crypto';
import { computeSha256Hex } from './dataset-loader';
import type {
  BlindAssignmentKeyEntry,
  BlindPacketItem,
  EvaluationBrief,
  TrialExecutionRecord,
} from './types';

export interface BlindPacketBundle {
  readonly seed: string;
  readonly rubricVersion: string;
  readonly reviewerPacket: readonly BlindPacketItem[];
  readonly reviewerPacketSha256: string;
  readonly armKeyMap: readonly BlindAssignmentKeyEntry[];
  readonly armKeyMapSha256: string;
}

const FORBIDDEN_BLIND_TOKENS = [
  'arm_a_sophia_basic',
  'arm_b_direct_model',
  'arm_a',
  'arm_b',
  'armId',
  'trialId',
  'BasicFirstValueService',
  'BASIC script preview',
  'Fixture Hook',
] as const;

/**
 * Deterministic PRNG (Mulberry32) seeded from SHA-256 of the experiment seed string.
 */
function createSeededPrng(seed: string): () => number {
  const digest = createHash('sha256').update(seed, 'utf8').digest();
  let state = digest.readUInt32BE(0) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle<T>(items: readonly T[], seed: string): T[] {
  const copy = [...items];
  const nextRand = createSeededPrng(seed);
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function buildBlindOutputId(seed: string, trialId: string, index: number): string {
  const hash = createHash('sha256')
    .update(`${seed}|${trialId}|${index}`, 'utf8')
    .digest('hex')
    .slice(0, 12);
  return `blind-${String(index + 1).padStart(4, '0')}-${hash}`;
}

/**
 * Strips any internal fixture provenance strings that could hint at which arm produced a script.
 */
export function sanitizeScriptForBlinding(renderedOutput: string): string {
  return renderedOutput
    .replace(/\[SIMULATED[^\]]*\]/gi, '[OFFLINE_FIXTURE]')
    .replace(/\[FIXTURE_STUB\]/gi, '[OFFLINE_FIXTURE]')
    .replace(/\[Fixture (Hook|Body|CTA)\]/gi, '[OFFLINE_FIXTURE]')
    .replace(/BASIC script preview/gi, 'script preview')
    .trim();
}

export function assertBlindPacketIsolation(reviewerPacket: readonly BlindPacketItem[]): void {
  const serialized = JSON.stringify(reviewerPacket);
  for (const token of FORBIDDEN_BLIND_TOKENS) {
    if (serialized.includes(token)) {
      throw new Error(`Blind packet isolation violation: forbidden token "${token}" found in reviewer packet`);
    }
  }
  const seenBlindIds = new Set<string>();
  for (const item of reviewerPacket) {
    if (seenBlindIds.has(item.blindOutputId)) {
      throw new Error(`Duplicate blindOutputId "${item.blindOutputId}" in reviewer packet`);
    }
    seenBlindIds.add(item.blindOutputId);
  }
}

export function buildBlindEvaluationPackets(
  trials: readonly TrialExecutionRecord[],
  briefs: readonly EvaluationBrief[],
  options: { readonly seed: string; readonly rubricVersion: string },
): BlindPacketBundle {
  if (!options.seed.trim()) {
    throw new Error('A non-empty random seed is required for reproducible blind assignment');
  }

  const briefById = new Map<string, EvaluationBrief>();
  for (const brief of briefs) {
    if (briefById.has(brief.briefId)) {
      throw new Error(`Duplicate briefId "${brief.briefId}" rejected during blind packet generation`);
    }
    briefById.set(brief.briefId, brief);
  }

  const seenTrialIds = new Set<string>();
  for (const trial of trials) {
    if (seenTrialIds.has(trial.trialId)) {
      throw new Error(`Duplicate trialId "${trial.trialId}" rejected during blind packet generation`);
    }
    seenTrialIds.add(trial.trialId);
    if (!briefById.has(trial.briefId)) {
      throw new Error(`Trial "${trial.trialId}" references unknown briefId "${trial.briefId}"`);
    }
  }

  const orderedTrials = [...trials].sort((a, b) => a.trialId.localeCompare(b.trialId));
  const shuffled = deterministicShuffle(orderedTrials, options.seed);

  const reviewerPacket: BlindPacketItem[] = [];
  const armKeyMap: BlindAssignmentKeyEntry[] = [];

  for (let i = 0; i < shuffled.length; i += 1) {
    const trial = shuffled[i];
    const brief = briefById.get(trial.briefId)!;
    const blindOutputId = buildBlindOutputId(options.seed, trial.trialId, i);

    reviewerPacket.push({
      blindOutputId,
      briefId: brief.briefId,
      industry: brief.industry,
      targetAudience: brief.targetAudience,
      productOrService: brief.productOrService,
      intendedPlatform: brief.intendedPlatform,
      campaignObjective: brief.campaignObjective,
      brandVoice: brief.brandVoice,
      language: brief.language,
      requiredCta: brief.requiredCta,
      contentRestrictions: brief.contentRestrictions,
      expectedDeliverable: brief.expectedDeliverable,
      rubricVersion: options.rubricVersion,
      renderedScript: sanitizeScriptForBlinding(trial.renderedOutput),
    });

    armKeyMap.push({
      blindOutputId,
      trialId: trial.trialId,
      briefId: trial.briefId,
      armId: trial.armId,
      trialNumber: trial.trialNumber,
      outputSha256: trial.outputSha256,
    });
  }

  assertBlindPacketIsolation(reviewerPacket);

  return {
    seed: options.seed,
    rubricVersion: options.rubricVersion,
    reviewerPacket,
    reviewerPacketSha256: computeSha256Hex(JSON.stringify(reviewerPacket)),
    armKeyMap,
    armKeyMapSha256: computeSha256Hex(JSON.stringify(armKeyMap)),
  };
}

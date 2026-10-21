/**
 * Binh Pháp (孫子兵法 — Art of War) mapping for the 25-Step Open-Core Blueprint
 *
 * Each blueprint step is filed under the Art of War chapter whose principle it
 * actually enacts, with a short bilingual reason naming that chapter's clause.
 * Chapters are used unevenly and out of step order on purpose: planning chapters
 * carry the early steps, momentum and method chapters carry the middle build,
 * and the terrain and intelligence chapters carry discovery and crisis response.
 *
 * The 13 chapters in canonical order: 始計 作戰 謀攻 軍形 兵勢 虛實 軍爭 九變
 * 行軍 地形 九地 火攻 用間.
 *
 * Layer: seed/config
 * @module seed/config/open-core-25-steps-binh-phap-map
 */

import type { OpenCoreStepDefinition } from './open-core-25-steps-catalog';
import { BINH_PHAP_THIEN, BINH_PHAP_STEP_MAPPING } from './open-core-25-steps-binh-phap-data';

export {
  BINH_PHAP_THIEN,
  BINH_PHAP_STEP_MAPPING,
  type BinhPhapThiên,
  type BinhPhapStepMapping,
} from './open-core-25-steps-binh-phap-data';

/** How many chapters Binh Pháp has — asserted by tests so a silent loss is caught. */
export const BINH_PHAP_TOTAL_THIEN: number = BINH_PHAP_THIEN.length;

export function getBinhPhapThienByNumber(
  number: number,
): (typeof BINH_PHAP_THIEN)[number] | undefined {
  return BINH_PHAP_THIEN.find((t) => t.number === number);
}

/** Returns the mapped chapter for a step, or undefined when unmapped. */
export function getBinhPhapThienForStep(
  step: OpenCoreStepDefinition,
): (typeof BINH_PHAP_THIEN)[number] | undefined {
  const mapping = BINH_PHAP_STEP_MAPPING.find((m) => m.step === step.step);
  return mapping ? getBinhPhapThienByNumber(mapping.thiênNumber) : undefined;
}

/**
 * Truth check used by tests: every step 1..25 mapped, every chapter used at
 * least once, and no step mapped to a chapter number outside 1..13.
 */
export interface BinhPhapCoverage {
  readonly totalSteps: number;
  readonly mappedSteps: number;
  readonly chaptersUsed: readonly number[];
  readonly chaptersUnused: readonly number[];
  readonly complete: boolean;
}

export function evaluateBinhPhapCoverage(): BinhPhapCoverage {
  const mapped = new Set(BINH_PHAP_STEP_MAPPING.map((m) => m.step));
  const chaptersUsed = Array.from(
    new Set(BINH_PHAP_STEP_MAPPING.map((m) => m.thiênNumber)),
  ).sort((a, b) => a - b);
  const chaptersUnused = BINH_PHAP_THIEN.filter(
    (t) => !chaptersUsed.includes(t.number),
  ).map((t) => t.number);
  const inRange = BINH_PHAP_STEP_MAPPING.every(
    (m) => m.step >= 1 && m.step <= 25 && m.thiênNumber >= 1 && m.thiênNumber <= 13,
  );

  return {
    totalSteps: 25,
    mappedSteps: mapped.size,
    chaptersUsed,
    chaptersUnused,
    complete: mapped.size === 25 && chaptersUnused.length === 0 && inRange,
  };
}

/**
 * Unit tests for the Binh Pháp mapping of the 25-step blueprint
 *
 * @module seed/config/__tests__/open-core-25-steps-binh-phap
 */

import { describe, expect, it } from 'vitest';
import {
  BINH_PHAP_TOTAL_THIEN,
  BINH_PHAP_THIEN,
  BINH_PHAP_STEP_MAPPING,
  evaluateBinhPhapCoverage,
  getBinhPhapThienByNumber,
  getBinhPhapThienForStep,
} from '../open-core-25-steps-binh-phap-map';
import { OPEN_CORE_25_STEPS } from '../open-core-25-steps-catalog';

describe('Binh Pháp (孫子兵法) 13-Chapter Reference', () => {
  it('holds all 13 chapters in canonical order', () => {
    expect(BINH_PHAP_THIEN).toHaveLength(13);
    expect(BINH_PHAP_TOTAL_THIEN).toBe(13);
    expect(BINH_PHAP_THIEN.map((t) => t.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
  });

  it('spells each chapter in Chinese, Sino-Vietnamese, Vietnamese, and English', () => {
    for (const thiên of BINH_PHAP_THIEN) {
      expect(thiên.hanzi.length).toBeGreaterThan(0);
      expect(thiên.sinoVietnamese.trim().length).toBeGreaterThan(0);
      expect(thiên.titleVi.trim().length).toBeGreaterThan(0);
      expect(thiên.titleEn.trim().length).toBeGreaterThan(0);
    }
  });

  it('looks a chapter up by its number', () => {
    expect(getBinhPhapThienByNumber(1)?.hanzi).toBe('始計');
    expect(getBinhPhapThienByNumber(13)?.sinoVietnamese).toBe('Dụng gian');
    expect(getBinhPhapThienByNumber(14)).toBeUndefined();
  });
});

describe('25-Step → 13-Chapter Mapping', () => {
  it('maps every one of the 25 steps', () => {
    const mapped = new Set(BINH_PHAP_STEP_MAPPING.map((m) => m.step));
    expect(mapped.size).toBe(25);
    for (let step = 1; step <= 25; step += 1) {
      expect(mapped.has(step)).toBe(true);
    }
  });

  it('uses all 13 chapters at least once, unevenly and not in step order', () => {
    const coverage = evaluateBinhPhapCoverage();
    expect(coverage.complete).toBe(true);
    expect(coverage.chaptersUnused).toHaveLength(0);
    expect(coverage.chaptersUsed).toHaveLength(13);
    expect(coverage.mappedSteps).toBe(25);

    const byCh7 = BINH_PHAP_STEP_MAPPING.filter((m) => m.thiênNumber === 7).length;
    const byCh11 = BINH_PHAP_STEP_MAPPING.filter((m) => m.thiênNumber === 11).length;
    expect(byCh11).toBeGreaterThan(0);
    expect(byCh7).toBeGreaterThan(0);

    const numbering = BINH_PHAP_STEP_MAPPING.map((m) => m.thiênNumber);
    expect(numbering).not.toEqual([...numbering].sort((a, b) => a - b));
  });

  it('never points a step at a chapter outside 1..13', () => {
    for (const mapping of BINH_PHAP_STEP_MAPPING) {
      expect(mapping.thiênNumber).toBeGreaterThanOrEqual(1);
      expect(mapping.thiênNumber).toBeLessThanOrEqual(13);
    }
  });

  it('carries a bilingual, non-empty justification for every step', () => {
    for (const mapping of BINH_PHAP_STEP_MAPPING) {
      expect(mapping.justificationVi.trim().length).toBeGreaterThan(10);
      expect(mapping.justificationEn.trim().length).toBeGreaterThan(10);
    }
  });

  it('resolves the chapter for a live step definition from the catalog', () => {
    for (const step of OPEN_CORE_25_STEPS) {
      const thiên = getBinhPhapThienForStep(step);
      expect(thiên, `step ${step.step} has no Binh Pháp chapter`).toBeDefined();
    }
  });
});

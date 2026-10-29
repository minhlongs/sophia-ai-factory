import { describe, expect, it } from 'vitest';
import { formatGuideHash, GUIDE_PILLAR_ALIASES, parseGuideHash, stepGuideTarget } from '../guide-hash-codec';
import type { GuideActiveTarget, GuidePillarNumber, GuideStageStep } from '../guide-hash-codec';
import { GUIDE_BACKEND_PILLARS, GUIDE_PIPELINE_STAGES } from '../index';
import { GUIDE_CIRCUIT_WIRES, GUIDE_SVG_COORDS } from '../guide-circuit-topology';

const STAGE_STEPS = GUIDE_PIPELINE_STAGES.map((stage) => stage.step as GuideStageStep);
const PILLAR_NUMBERS = GUIDE_BACKEND_PILLARS.map((pillar) => pillar.number as GuidePillarNumber);
const LAST_STAGE_STEP = STAGE_STEPS[STAGE_STEPS.length - 1] as GuideStageStep;
const LAST_PILLAR_NUMBER = PILLAR_NUMBERS[PILLAR_NUMBERS.length - 1] as GuidePillarNumber;

/** Parses a hash that must resolve, so a null result fails the test loudly. */
function parsed(hash: string): GuideActiveTarget {
  const target = parseGuideHash(hash);
  if (target === null) {
    throw new Error(`expected "${hash}" to parse into a guide target, got null`);
  }
  return target;
}

describe('guide hash codec', () => {
  it('parses every stage hash in the catalog', () => {
    STAGE_STEPS.forEach((step) => {
      expect(parseGuideHash(`#stage-${step}`)).toEqual({ mode: 'stage', step });
    });
  });

  it('parses every pillar hash in the catalog', () => {
    PILLAR_NUMBERS.forEach((number) => {
      expect(parseGuideHash(`#pillar-${number}`)).toEqual({ mode: 'pillar', number });
    });
  });

  it('parses every documented pillar alias', () => {
    Object.entries(GUIDE_PILLAR_ALIASES).forEach(([alias, number]) => {
      expect(parseGuideHash(`#${alias}`)).toEqual({ mode: 'pillar', number });
    });
  });

  it('ships exactly the eight canonical aliases', () => {
    expect(Object.keys(GUIDE_PILLAR_ALIASES).sort()).toEqual([
      'affiliate',
      'byok',
      'compliance',
      'economics',
      'governance',
      'omnichannel',
      'telegram',
      'video',
    ]);
    expect(new Set(Object.values(GUIDE_PILLAR_ALIASES)).size).toBe(8);
  });

  it('resolves every alias to a pillar that exists in the catalog', () => {
    Object.values(GUIDE_PILLAR_ALIASES).forEach((number) => {
      expect(PILLAR_NUMBERS).toContain(number);
    });
  });

  it('returns null for empty, hash-only, and unknown input', () => {
    ['', '#', '   ', '#unknown', '#stage', '#pillar', '#stages-3', '#pillar1', '#nope-9'].forEach(
      (hash) => {
        expect(parseGuideHash(hash)).toBeNull();
      },
    );
  });

  it('returns null instead of clamping out-of-range numbers', () => {
    expect(parseGuideHash('#stage-0')).toBeNull();
    expect(parseGuideHash('#stage-9')).toBeNull();
    expect(parseGuideHash('#pillar-0')).toBeNull();
    expect(parseGuideHash('#pillar-9')).toBeNull();
  });

  it('tolerates a missing hash marker and uppercase input', () => {
    expect(parseGuideHash('stage-3')).toEqual({ mode: 'stage', step: 3 });
    expect(parseGuideHash('#STAGE-3')).toEqual({ mode: 'stage', step: 3 });
    expect(parseGuideHash('#Telegram')).toEqual({ mode: 'pillar', number: 7 });
    expect(parseGuideHash('#PILLAR-8')).toEqual({ mode: 'pillar', number: 8 });
  });

  it('formats stage and pillar targets back into hashes', () => {
    expect(formatGuideHash({ mode: 'stage', step: 3 })).toBe('#stage-3');
    expect(formatGuideHash({ mode: 'pillar', number: 7 })).toBe('#pillar-7');
  });

  it('round-trips format(parse(x)) === x for every stage and pillar', () => {
    STAGE_STEPS.forEach((step) => {
      const hash = `#stage-${step}`;
      expect(formatGuideHash(parsed(hash))).toBe(hash);
    });
    PILLAR_NUMBERS.forEach((number) => {
      const hash = `#pillar-${number}`;
      expect(formatGuideHash(parsed(hash))).toBe(hash);
    });
  });

  it('round-trips an alias into its canonical pillar hash', () => {
    Object.entries(GUIDE_PILLAR_ALIASES).forEach(([alias, number]) => {
      expect(formatGuideHash(parsed(`#${alias}`))).toBe(`#pillar-${number}`);
    });
  });

  it('clamps the stage range at both ends without wrapping', () => {
    expect(stepGuideTarget({ mode: 'stage', step: 1 }, -1)).toEqual({ mode: 'stage', step: 1 });
    expect(stepGuideTarget({ mode: 'stage', step: 1 }, 1)).toEqual({ mode: 'stage', step: 2 });
    expect(stepGuideTarget({ mode: 'stage', step: LAST_STAGE_STEP }, 1)).toEqual({
      mode: 'stage',
      step: LAST_STAGE_STEP,
    });
  });

  it('clamps the pillar range at both ends without wrapping', () => {
    expect(stepGuideTarget({ mode: 'pillar', number: 1 }, -1)).toEqual({ mode: 'pillar', number: 1 });
    expect(stepGuideTarget({ mode: 'pillar', number: 1 }, 1)).toEqual({ mode: 'pillar', number: 2 });
    expect(stepGuideTarget({ mode: 'pillar', number: LAST_PILLAR_NUMBER }, 1)).toEqual({
      mode: 'pillar',
      number: LAST_PILLAR_NUMBER,
    });
  });

  it('steps a mid-range target each way in both modes', () => {
    expect(stepGuideTarget({ mode: 'stage', step: 3 }, -1)).toEqual({ mode: 'stage', step: 2 });
    expect(stepGuideTarget({ mode: 'stage', step: 3 }, 1)).toEqual({ mode: 'stage', step: 4 });
    expect(stepGuideTarget({ mode: 'pillar', number: 4 }, -1)).toEqual({ mode: 'pillar', number: 3 });
    expect(stepGuideTarget({ mode: 'pillar', number: 4 }, 1)).toEqual({ mode: 'pillar', number: 5 });
  });

  it('keeps the alias and stage namespaces disjoint', () => {
    const aliasKeys = Object.keys(GUIDE_PILLAR_ALIASES);
    const stageSlugs = STAGE_STEPS.map((step) => `stage-${step}`);
    expect(aliasKeys.filter((alias) => stageSlugs.includes(alias))).toEqual([]);
  });

  // The hash arrives from a URL, so inherited prototype members must never
  // resolve into a pillar index. `parseGuideHash` lowercases its input, so these
  // two spellings are the only prototype members that survive to the lookup —
  // they are also the two that resolve to a non-numeric value without a guard.
  it.each(['#constructor', '#__proto__'])('rejects the prototype member %s', (hash) => {
    const target = parseGuideHash(hash);
    expect(target).toBeNull();
  });

  it('keeps prototype members out of the alias table itself', () => {
    ['constructor', '__proto__', 'tostring', 'hasownproperty', 'valueof', 'isprototypeof'].forEach(
      (key) => {
        expect(Object.hasOwn(GUIDE_PILLAR_ALIASES, key)).toBe(false);
      },
    );
  });
});

describe('guide circuit topology', () => {
  it('wires only steps and numbers that exist in the catalog', () => {
    GUIDE_CIRCUIT_WIRES.forEach((wire) => {
      expect(STAGE_STEPS).toContain(wire.stageStep);
      expect(PILLAR_NUMBERS).toContain(wire.pillarNumber);
    });
  });

  it('connects every pipeline stage to at least one pillar', () => {
    STAGE_STEPS.forEach((step) => {
      expect(GUIDE_CIRCUIT_WIRES.filter((wire) => wire.stageStep === step).length).toBeGreaterThan(0);
    });
  });

  it('declares no duplicate wires', () => {
    const keys = GUIDE_CIRCUIT_WIRES.map((wire) => `${wire.stageStep}-${wire.pillarNumber}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('exposes exactly five stations and eight chips inside the viewBox', () => {
    const { viewBox, stations, chips } = GUIDE_SVG_COORDS;
    expect(viewBox).toBe('0 0 680 420');
    expect(stations).toHaveLength(GUIDE_PIPELINE_STAGES.length);
    expect(chips).toHaveLength(GUIDE_BACKEND_PILLARS.length);

    const all = [...stations, ...chips];
    all.forEach((node) => {
      expect(node.x).toBeGreaterThan(0);
      expect(node.x).toBeLessThan(680);
      expect(node.y).toBeGreaterThan(0);
      expect(node.y).toBeLessThan(420);
    });

    const stationsByStep = stations.map((station) => station.step);
    expect(new Set(stationsByStep).size).toBe(stations.length);
    const chipsByNumber = chips.map((chip) => chip.number);
    expect(new Set(chipsByNumber).size).toBe(chips.length);
  });

  it('never overlaps two x positions and keeps stations apart from chips', () => {
    const stationXs = GUIDE_SVG_COORDS.stations.map((station) => station.x);
    expect(new Set(stationXs).size).toBe(stationXs.length);
    const chipXs = GUIDE_SVG_COORDS.chips.map((chip) => chip.x);
    expect(new Set(chipXs).size).toBe(chipXs.length);
    expect(GUIDE_SVG_COORDS.stations[0].y).toBeLessThan(GUIDE_SVG_COORDS.chips[0].y);
  });

  it('labels every station and chip in both Vietnamese and English', () => {
    [...GUIDE_SVG_COORDS.stations, ...GUIDE_SVG_COORDS.chips].forEach((node) => {
      expect(node.label.vi.length).toBeGreaterThan(0);
      expect(node.label.en.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Unit tests for the inspector item builder.
 * The index arrives from a URL hash, so the whole point of these tests is that
 * no index — however malformed — can produce a missing catalogue entry.
 */

import { describe, expect, it } from 'vitest';
import {
  buildInspectorItem,
  buildPillarItem,
  buildStageItem,
  crossLinks,
  formatCounter,
  RAIL,
} from '../guide-inspector-items';
import { GUIDE_BACKEND_PILLARS, GUIDE_CIRCUIT_WIRES, GUIDE_PIPELINE_STAGES } from '@/seed/guide';

const LABELS = {
  inputLabel: 'Input',
  engineLabel: 'Engine',
  outputLabel: 'Output',
  capabilitiesLabel: 'Capabilities',
  safetyLabel: 'Safety',
  proofLabel: 'Proof',
  crossLinkLabel: 'See also',
  previous: 'Previous',
  next: 'Next',
  quickSelect: 'Quick select',
  counterStage: 'STAGE {index} / {total}',
  counterPillar: 'PILLAR {index} / {total}',
};

describe('buildStageItem', () => {
  it('builds the requested stage when the index is valid', () => {
    const item = buildStageItem(3, 'vi', LABELS);
    expect(item.icon).toBe('03');
    expect(item.badge).toBe('STAGE 03');
    expect(item.title).toBe(GUIDE_PIPELINE_STAGES[2].name.vi);
  });

  it('clamps a non-integer index instead of producing a missing entry', () => {
    const item = buildStageItem(Number.NaN, 'vi', LABELS);
    expect(item.icon).toBe('01');
    expect(item.title).toBe(GUIDE_PIPELINE_STAGES[0].name.vi);
  });

  it('clamps an out-of-range index at both ends', () => {
    expect(buildStageItem(-99, 'vi', LABELS).title).toBe(GUIDE_PIPELINE_STAGES[0].name.vi);
    const last = GUIDE_PIPELINE_STAGES[GUIDE_PIPELINE_STAGES.length - 1];
    expect(buildStageItem(9999, 'vi', LABELS).title).toBe(last.name.vi);
  });
});

describe('buildPillarItem', () => {
  it('builds the requested pillar when the index is valid', () => {
    const item = buildPillarItem(8, 'en', LABELS);
    expect(item.title).toBe(GUIDE_BACKEND_PILLARS[7].title.en);
  });

  it('clamps a non-integer index instead of producing a missing entry', () => {
    const item = buildPillarItem(Number.NaN, 'vi', LABELS);
    expect(item.title).toBe(GUIDE_BACKEND_PILLARS[0].title.vi);
  });

  it('clamps an out-of-range index at both ends', () => {
    expect(buildPillarItem(0, 'vi', LABELS).title).toBe(GUIDE_BACKEND_PILLARS[0].title.vi);
    expect(buildPillarItem(9999, 'vi', LABELS).title).toBe(
      GUIDE_BACKEND_PILLARS[GUIDE_BACKEND_PILLARS.length - 1].title.vi,
    );
  });
});

describe('buildInspectorItem', () => {
  it('routes stage and pillar modes without branching in the caller', () => {
    expect(buildInspectorItem('stage', 2, 'vi', LABELS).badge).toBe('STAGE 02');
    expect(buildInspectorItem('pillar', 2, 'vi', LABELS).counterTemplate).toBe(
      'PILLAR {index} / {total}',
    );
  });
});

describe('crossLinks', () => {
  it('finds peers for every wired station', () => {
    GUIDE_CIRCUIT_WIRES.forEach((wire) => {
      const peers = crossLinks('stage', wire.stageStep);
      expect(peers.some((p) => p.mode === 'pillar' && p.number === wire.pillarNumber)).toBe(true);
    });
  });

  it('finds peers for every wired pillar', () => {
    GUIDE_CIRCUIT_WIRES.forEach((wire) => {
      const peers = crossLinks('pillar', wire.pillarNumber);
      expect(peers.some((p) => p.mode === 'stage' && p.step === wire.stageStep)).toBe(true);
    });
  });

  it('only ever returns targets that exist in the catalogue', () => {
    crossLinks('stage', 4).forEach((peer) => {
      expect(GUIDE_BACKEND_PILLARS.some((p) => p.number === (peer as { number: number }).number)).toBe(
        true,
      );
    });
  });
});

describe('formatCounter', () => {
  it('zero-pads both placeholders', () => {
    expect(formatCounter('TRẠM {index} / {total}', 3, 5)).toBe('TRẠM 03 / 05');
  });

  it('does not pad two-digit values', () => {
    expect(formatCounter('TRẠM {index} / {total}', 8, 8)).toBe('TRẠM 08 / 08');
  });
});

describe('RAIL', () => {
  it('covers the whole catalogue in each mode', () => {
    expect(RAIL.stage.length).toBe(GUIDE_PIPELINE_STAGES.length);
    expect(RAIL.pillar.length).toBe(GUIDE_BACKEND_PILLARS.length);
  });
});
